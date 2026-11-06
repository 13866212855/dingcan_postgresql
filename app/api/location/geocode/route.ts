import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * 免费逆地理编码服务：将客户端获取到的 GPS/浏览器定位经纬度（WGS-84 或 GCJ-02）
 * 转换为具体的中文结构化地址（省、市、区、街道、门牌）。
 *
 * 采用多层免费回退策略，零成本且保障成功率：
 * 1. 优先使用商户后台配置的高德 Web 服务 API Key（若有配置，每天免费 5000 次，国内精度最高）
 * 2. 备用或无 Key 时：调用大德公开免费逆地理服务 / BigDataCloud 免签全球地理编码
 * 3. 终极兜底：OpenStreetMap Nominatim 免签公开接口
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: '经纬度参数不合法' },
        { status: 400 }
      );
    }

    const settings = await getSettings(tenantId);
    const amapKey = (settings as any)?.amap_web_key?.trim() || process.env.AMAP_WEB_KEY?.trim() || '';

    // 1. 若配置了高德 Key，直接调用高德 Web 服务 API（国内最准，精确到小区与门牌）
    if (amapKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        // 高德经纬度格式为：lng,lat
        const amapUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(amapKey)}&location=${lng.toFixed(6)},${lat.toFixed(6)}&extensions=all`;
        const res = await fetch(amapUrl, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        if (data.status === '1' && data.regeocode?.formatted_address) {
          const regeo = data.regeocode;
          const addressComp = regeo.addressComponent || {};
          const city = typeof addressComp.city === 'string' ? addressComp.city : (addressComp.province || '');
          const district = addressComp.district || '';
          const township = addressComp.township || '';
          const street = addressComp.streetNumber?.street || '';
          const number = addressComp.streetNumber?.number || '';

          // 提取核心街道门牌或就近知名建筑物
          const poiName = regeo.pois?.[0]?.name || '';
          let shortAddress = regeo.formatted_address;
          // 若有就近地标/小区名，贴心附在街道后
          if (poiName && !shortAddress.includes(poiName)) {
            shortAddress = `${shortAddress}（靠近${poiName}）`;
          }

          return NextResponse.json({
            success: true,
            data: {
              formattedAddress: shortAddress,
              province: addressComp.province || '',
              city,
              district,
              township,
              street: `${street}${number}`,
              poiName,
              source: 'amap',
            },
          });
        }
      } catch (amapErr) {
        console.warn('[Geocode] Amap failed, falling back to public geocoder:', amapErr);
      }
    }

    // 2. 免签公开服务 A：BigDataCloud 免费客户端逆地理编码（支持中文，响应速度快，无需 Key）
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}&localityLanguage=zh`;
      const res = await fetch(bdcUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const province = data.principalSubdivision || '';
        const city = data.city || '';
        const locality = data.locality || '';
        const parts = [province, city, locality].filter(Boolean);
        // 去重拼接
        const uniqueParts: string[] = [];
        parts.forEach((p) => {
          if (!uniqueParts.some((up) => up.includes(p) || p.includes(up))) {
            uniqueParts.push(p);
          }
        });
        const combined = uniqueParts.join('');
        if (combined) {
          return NextResponse.json({
            success: true,
            data: {
              formattedAddress: combined,
              province,
              city,
              district: locality,
              source: 'bigdatacloud',
            },
          });
        }
      }
    } catch (bdcErr) {
      console.warn('[Geocode] BigDataCloud failed, falling back to OSM:', bdcErr);
    }

    // 3. 免签公开服务 B：OpenStreetMap Nominatim 全球开源逆地理编码（无调用限制，中文返回）
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&format=json&accept-language=zh-CN`;
      const res = await fetch(osmUrl, {
        headers: { 'User-Agent': 'Restaurant-Ordering-App/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          // Nominatim 会返回较冗长的国家/省市结构，做适当友好修剪
          const addr = data.address || {};
          const state = addr.state || addr.province || '';
          const city = addr.city || addr.town || addr.county || '';
          const suburb = addr.suburb || addr.district || '';
          const road = addr.road || addr.street || '';
          const house = addr.house_number || '';
          const short = [state, city, suburb, road, house].filter(Boolean).join('');

          return NextResponse.json({
            success: true,
            data: {
              formattedAddress: short || data.display_name,
              province: state,
              city,
              district: suburb,
              street: `${road}${house}`,
              source: 'osm',
            },
          });
        }
      }
    } catch (osmErr) {
      console.warn('[Geocode] OSM failed:', osmErr);
    }

    // 若全部逆地理接口暂时网络不通，返回经纬度友好提示由顾客直接填写
    return NextResponse.json({
      success: true,
      data: {
        formattedAddress: '',
        lat,
        lng,
        source: 'gps_only',
        note: '已成功获取当前精准经纬度，请补充具体门牌号',
      },
    });
  } catch (error: any) {
    console.error('[Geocode API Error]', error);
    return NextResponse.json(
      { success: false, error: '逆地理定位服务异常: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
