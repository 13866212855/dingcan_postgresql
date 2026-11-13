import fs from 'fs';
import path from 'path';

export interface SkillFileMeta {
  id: string;
  relativePath: string;
  zipPath: string;
  title: string;
  summary: string;
  category: '主规范' | '参考规范';
}

export interface SkillFileItem extends SkillFileMeta {
  content: string;
  bytes: number;
  lines: number;
}

export const SKILL_NAME = 'my_create_multenant';

const SKILL_FILES_ALLOWLIST: SkillFileMeta[] = [
  {
    id: 'skill-md',
    relativePath: 'SKILL.md',
    zipPath: 'my_create_multenant/SKILL.md',
    title: '主规范手册 (SKILL.md)',
    summary: '技能触发条件、8 条架构红线、6 阶段构建流水线与交付验收清单',
    category: '主规范',
  },
  {
    id: 'ref-db',
    relativePath: 'references/1_database_and_tenant_isolation.md',
    zipPath: 'my_create_multenant/references/1_database_and_tenant_isolation.md',
    title: '1. 数据库多租户隔离与通用模型',
    summary: '租户解析优先级链、PostgreSQL 共享表 DDL、事务开户与跨业务域映射',
    category: '参考规范',
  },
  {
    id: 'ref-auth',
    relativePath: 'references/2_auth_signing_and_rbac.md',
    zipPath: 'my_create_multenant/references/2_auth_signing_and_rbac.md',
    title: '2. 签名鉴权与动态 RBAC 引擎',
    summary: 'scrypt 密码哈希、HMAC-SHA256 令牌、单入口自愈与防越权子集守卫',
    category: '参考规范',
  },
  {
    id: 'ref-ui',
    relativePath: 'references/3_frontend_separation_and_ui.md',
    zipPath: 'my_create_multenant/references/3_frontend_separation_and_ui.md',
    title: '3. 前后台分离与 UI 交互契约',
    summary: '动态元数据、无参后台自净、中性单入口表单与权限驱动界面裁剪',
    category: '参考规范',
  },
];

export const SKILL_PROMPT_TEMPLATES = [
  {
    id: 'new-saas',
    title: '新建通用多租户 SaaS 项目',
    desc: '引导智能体读取并严格遵循 my_create_multenant 构建全新多租户系统',
    prompt:
      '请先阅读项目中的 skills/my_create_multenant/SKILL.md 及 references 下的全部参考规范，严格按照其中定义的多租户上下文隔离、数据库管理员表 + HMAC 签名令牌、单入口智能登录、动态 RBAC 防越权与前后台分离架构，使用 Next.js App Router + PostgreSQL 原生 SQL 从零搭建本项目（所有页面使用中文显示）。',
  },
  {
    id: 'new-booking',
    title: '新建多门店预约 / 服务类系统',
    desc: '将通用业务骨架映射为多门店预约、技师排班与核销管理平台',
    prompt:
      '请加载 skills/my_create_multenant 技能，将通用 resources 表映射为服务项目、work_orders 表映射为到店预约单，为每个租户预置「顾问/技师」与「前台核销员」角色，并按技能中的统一单入口登录与数据库签名鉴权规范完成前后台搭建（全部界面中文显示）。',
  },
  {
    id: 'upgrade-auth',
    title: '重构现有项目鉴权与角色越权防线',
    desc: '按技能参考规范二对旧系统进行签名令牌与 RBAC 安全加固',
    prompt:
      '请参照 skills/my_create_multenant/references/2_auth_signing_and_rbac.md，检查并升级当前项目的管理员鉴权、员工会话、不可下放敏感权限保护以及角色授权子集校检逻辑，确保所有接口满足 Fail-Closed 隔离标准。',
  },
];

function getSkillBaseDir(): string {
  return path.resolve(process.cwd(), 'skills', SKILL_NAME);
}

export function loadSkillFiles(): SkillFileItem[] {
  const baseDir = getSkillBaseDir();

  return SKILL_FILES_ALLOWLIST.map((meta) => {
    const resolved = path.resolve(baseDir, meta.relativePath);
    if (!resolved.startsWith(baseDir + path.sep)) {
      throw new Error(`非法技能文件路径: ${meta.relativePath}`);
    }
    const content = fs.readFileSync(resolved, 'utf8');
    const bytes = Buffer.byteLength(content, 'utf8');
    const lines = content.split(/\r?\n/).length;
    return {
      ...meta,
      content,
      bytes,
      lines,
    };
  });
}

// 预计算标准 IEEE 802.3 CRC32 查找表
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

/**
 * 纯 TypeScript 构造标准 STORE(无压缩) ZIP 归档包（支持 UTF-8 文件名，兼容 Windows/macOS/Linux 解压）
 */
export function buildSkillZipBuffer(files: SkillFileItem[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosTime, dosDate } = toDosDateTime(new Date());

  for (const file of files) {
    const nameBuf = Buffer.from(file.zipPath, 'utf8');
    const dataBuf = Buffer.from(file.content, 'utf8');
    const crc = crc32(dataBuf);

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed: 2.0
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(0, 8); // compression: STORE
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBuf, dataBuf);

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 filename flag
    centralHeader.writeUInt16LE(0, 10); // compression: STORE
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralBuffer, eocd]);
}
