package com.redtourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.redtourism.entity.*;
import com.redtourism.mapper.*;
import com.redtourism.service.StatsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class StatsServiceImpl implements StatsService {

    @Autowired
    private ScenicSpotMapper spotMapper;
    @Autowired
    private RouteMapper routeMapper;
    @Autowired
    private HotelMapper hotelMapper;
    @Autowired
    private FoodMapper foodMapper;

    @Override
    public Map<String, Object> moduleOverview(String module, Long staffId, String startDate, String endDate) {
        Date start = parseDay(startDate, false);
        Date end = parseDay(endDate, true);

        long total = countBy(module, staffId, null, null, null);
        long rangeCount = countBy(module, staffId, null, start, end);

        // 与所选范围等长的上一周期，用于展示趋势对比
        long previousCount = 0L;
        int rangeDays = 0;
        if (start != null && end != null && !end.before(start)) {
            rangeDays = (int) ((end.getTime() - start.getTime()) / 86400000L) + 1;
            Calendar cs = Calendar.getInstance();
            cs.setTime(start);
            cs.add(Calendar.DAY_OF_MONTH, -rangeDays);
            Calendar ce = Calendar.getInstance();
            ce.setTime(start);
            ce.add(Calendar.DAY_OF_MONTH, -1);
            previousCount = countBy(module, staffId, null, cs.getTime(), ce.getTime());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("module", module);
        result.put("total", total);
        result.put("rangeCount", rangeCount);
        result.put("previousCount", previousCount);
        result.put("rangeDays", rangeDays);
        result.put("start", startDate);
        result.put("end", endDate);
        return result;
    }

    private long countBy(String module, Long staffId, String keyword, Date start, Date end) {
        switch (module) {
            case "spot": return spotMapper.selectCount(spotWrapper(staffId, keyword, start, end));
            case "route": return routeMapper.selectCount(routeWrapper(keyword, start, end));
            case "hotel": return hotelMapper.selectCount(hotelWrapper(keyword, start, end));
            case "food": return foodMapper.selectCount(foodWrapper(keyword, start, end));
            default: throw new IllegalArgumentException("不支持的数据模块: " + module);
        }
    }

    /* ==================== 各模块查询条件（统计与管理列表共用，保证口径一致） ==================== */

    public static LambdaQueryWrapper<ScenicSpot> spotWrapper(Long staffId, String keyword, Date start, Date end) {
        LambdaQueryWrapper<ScenicSpot> w = new LambdaQueryWrapper<>();
        if (staffId != null) w.eq(ScenicSpot::getStaffId, staffId);
        if (hasText(keyword)) {
            String k = keyword.trim();
            w.and(x -> x.like(ScenicSpot::getName, k)
                    .or().like(ScenicSpot::getRegion, k)
                    .or().like(ScenicSpot::getTheme, k)
                    .or().like(ScenicSpot::getLocation, k));
        }
        applyCreateTime(w, ScenicSpot::getCreateTime, start, end);
        return w;
    }

    public static LambdaQueryWrapper<Route> routeWrapper(String keyword, Date start, Date end) {
        LambdaQueryWrapper<Route> w = new LambdaQueryWrapper<>();
        if (hasText(keyword)) {
            String k = keyword.trim();
            w.and(x -> x.like(Route::getName, k).or().like(Route::getDescription, k));
        }
        applyCreateTime(w, Route::getCreateTime, start, end);
        return w;
    }

    public static LambdaQueryWrapper<Hotel> hotelWrapper(String keyword, Date start, Date end) {
        LambdaQueryWrapper<Hotel> w = new LambdaQueryWrapper<>();
        if (hasText(keyword)) {
            String k = keyword.trim();
            w.and(x -> x.like(Hotel::getName, k).or().like(Hotel::getLocation, k));
        }
        applyCreateTime(w, Hotel::getCreateTime, start, end);
        return w;
    }

    public static LambdaQueryWrapper<Food> foodWrapper(String keyword, Date start, Date end) {
        LambdaQueryWrapper<Food> w = new LambdaQueryWrapper<>();
        if (hasText(keyword)) {
            String k = keyword.trim();
            w.and(x -> x.like(Food::getName, k).or().like(Food::getDescription, k));
        }
        applyCreateTime(w, Food::getCreateTime, start, end);
        return w;
    }

    private static boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private static <T> void applyCreateTime(LambdaQueryWrapper<T> w,
                                            com.baomidou.mybatisplus.core.toolkit.support.SFunction<T, ?> column,
                                            Date start, Date end) {
        if (start != null) w.ge(column, start);
        if (end != null) w.le(column, end);
    }

    /** 解析 yyyy-MM-dd；atEnd=true 时取当天 23:59:59，否则取 00:00:00 */
    public static Date parseDay(String text, boolean atEnd) {
        if (text == null || text.trim().isEmpty()) return null;
        String t = text.trim();
        // 兼容直接传入完整时间
        if (t.length() > 10) {
            for (String p : new String[]{"yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm"}) {
                try { return new SimpleDateFormat(p).parse(t); } catch (ParseException ignore) {}
            }
        }
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd").parse(t.substring(0, 10));
            if (atEnd) {
                Calendar c = Calendar.getInstance();
                c.setTime(d);
                c.add(Calendar.DAY_OF_MONTH, 1);
                c.add(Calendar.SECOND, -1);
                return c.getTime();
            }
            return d;
        } catch (ParseException e) {
            return null;
        }
    }
}
