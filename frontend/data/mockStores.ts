/**
 * 门店演示数据（前端离线兜底）。
 *
 * 与 `backend/mcp/../fixtures/stores.json` 保持同一组门店，
 * 用于后端不可用时 `/store` 页面仍可完整演示。
 *
 * ⚠️ 这不是真实门店：storeCode 用 DEMO 前缀，名称带「（演示）」标识。
 * 真实门店由后端调用麦当劳 MCP `query-nearby-stores` 获取。
 */

import type { ProviderStore } from "@/lib/provider/types";

/** 仅用于本地过滤，不进入 ProviderStore */
type MockStore = ProviderStore & { city: string };

export const MOCK_STORES: MockStore[] = [
  {
    storeCode: "DEMO001",
    storeName: "麦当劳·人民广场餐厅（演示）",
    address: "演示地址：黄浦区南京西路 000 号",
    city: "上海",
    distance: 320,
    businessStatus: true,
    businessStartTime: "07:00",
    businessEndTime: "23:00",
    hoursText: "早餐(07:00至10:15)，午餐(10:45至14:15)，下午茶(14:45至16:45)，夜市(17:15至21:45)",
    reservation: true,
  },
  {
    storeCode: "DEMO002",
    storeName: "麦当劳·陆家嘴餐厅（演示）",
    address: "演示地址：浦东新区世纪大道 000 号",
    city: "上海",
    distance: 1850,
    businessStatus: true,
    businessStartTime: "06:30",
    businessEndTime: "23:00",
    hoursText: "早餐(06:30至10:15)，午餐(10:45至14:15)，下午茶(14:45至16:45)，夜市(17:15至22:45)",
    reservation: false,
  },
  {
    storeCode: "DEMO003",
    storeName: "麦当劳·徐家汇餐厅（演示）",
    address: "演示地址：徐汇区漕溪北路 000 号",
    city: "上海",
    distance: 4300,
    businessStatus: false,
    businessStartTime: "07:00",
    businessEndTime: "22:00",
    hoursText: "早餐(07:00至10:15)，午餐(10:45至14:15)，夜市(17:15至21:45)",
    reservation: true,
  },
  {
    storeCode: "DEMO004",
    storeName: "麦当劳·国贸餐厅（演示）",
    address: "演示地址：朝阳区建国门外大街 000 号",
    city: "北京",
    distance: 900,
    businessStatus: true,
    businessStartTime: "07:00",
    businessEndTime: "23:00",
    hoursText: "早餐(07:00至10:15)，午餐(10:45至14:15)，夜市(17:15至21:45)，宵夜(22:15至23:00)",
    reservation: true,
  },
  {
    storeCode: "DEMO005",
    storeName: "麦当劳·中关村餐厅（演示）",
    address: "演示地址：海淀区中关村大街 000 号",
    city: "北京",
    distance: 6200,
    businessStatus: false,
    businessStartTime: "06:30",
    businessEndTime: "22:00",
    hoursText: "早餐(06:30至10:15)，午餐(10:45至14:15)，夜市(17:15至21:45)",
    reservation: false,
  },
  {
    storeCode: "DEMO006",
    storeName: "麦当劳·24 小时餐厅（演示）",
    address: "演示地址：静安区南京西路 000 号",
    city: "上海",
    distance: 2400,
    businessStatus: true,
    businessStartTime: "00:00",
    businessEndTime: "23:59",
    hoursText: "全天营业(00:00至23:59)",
    reservation: false,
  },
];

/**
 * 本地门店过滤。
 *
 * 语义与后端 Mock 保持一致：city 精确匹配 + keyword 子串匹配；
 * 两者都为空返回全部；无匹配时返回全部（避免演示出现空列表）。
 */
export function filterMockStores(city: string, keyword: string): ProviderStore[] {
  const c = city.trim();
  const k = keyword.trim();

  if (!c && !k) return MOCK_STORES.map(stripCity);

  const hits = MOCK_STORES.filter((s) => {
    if (c && s.city !== c) return false;
    if (k && !`${s.storeName}${s.address}`.includes(k)) return false;
    return true;
  });

  return (hits.length > 0 ? hits : MOCK_STORES).map(stripCity);
}

function stripCity({ city: _city, ...store }: MockStore): ProviderStore {
  return store;
}
