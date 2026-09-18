package com.redtourism.service;

import java.util.Map;

/**
 * 管理端仪表盘数据总览：按景点、线路、酒店、美食分块统计。
 * 所有统计口径与管理列表页的查询条件保持一致（含工作人员数据权限），
 * 保证仪表盘数字与对应列表 total 对得上。
 */
public interface StatsService {

    /**
     * @param module    spot | route | hotel | food
     * @param staffId   工作人员ID（仅景点模块按归属过滤）；管理员传 null
     * @param startDate 起始日期 yyyy-MM-dd（可空）
     * @param endDate   截止日期 yyyy-MM-dd（含当天，可空）
     * @return {total, rangeCount, previousCount, rangeDays, start, end}
     */
    Map<String, Object> moduleOverview(String module, Long staffId, String startDate, String endDate);
}
