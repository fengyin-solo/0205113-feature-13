package com.redtourism.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.redtourism.common.Constants;
import com.redtourism.common.Result;
import com.redtourism.entity.*;
import com.redtourism.mapper.*;
import com.redtourism.service.StatsService;
import com.redtourism.service.impl.StatsServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpSession;
import java.util.*;

/**
 * 管理端列表查询与仪表盘总览。
 * 列表与统计共用 {@link StatsServiceImpl} 中的 xxxWrapper 条件构造，
 * 保证仪表盘总数/区间数与列表页分页 total 口径一致。
 */
@RestController
@RequestMapping("/api/admin")
public class AdminQueryController {

    @Autowired
    private RouteMapper routeMapper;
    @Autowired
    private HotelMapper hotelMapper;
    @Autowired
    private FoodMapper foodMapper;
    @Autowired
    private FoodStoreMapper foodStoreMapper;
    @Autowired
    private StatsService statsService;

    private static final int MAX_SIZE = 100;

    // ==================== 管理端分页列表 ====================

    @GetMapping("/route/list")
    public Result<IPage<Route>> routeList(@RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "10") int size,
                                          @RequestParam(required = false) String keyword,
                                          @RequestParam(required = false) String startDate,
                                          @RequestParam(required = false) String endDate) {
        LambdaQueryWrapper<Route> w = StatsServiceImpl.routeWrapper(keyword,
                StatsServiceImpl.parseDay(startDate, false), StatsServiceImpl.parseDay(endDate, true));
        w.orderByDesc(Route::getCreateTime);
        return Result.success(routeMapper.selectPage(new Page<>(page, clampSize(size)), w));
    }

    @GetMapping("/hotel/list")
    public Result<IPage<Hotel>> hotelList(@RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "10") int size,
                                          @RequestParam(required = false) String keyword,
                                          @RequestParam(required = false) String startDate,
                                          @RequestParam(required = false) String endDate) {
        LambdaQueryWrapper<Hotel> w = StatsServiceImpl.hotelWrapper(keyword,
                StatsServiceImpl.parseDay(startDate, false), StatsServiceImpl.parseDay(endDate, true));
        w.orderByDesc(Hotel::getCreateTime);
        return Result.success(hotelMapper.selectPage(new Page<>(page, clampSize(size)), w));
    }

    @GetMapping("/food/list")
    public Result<IPage<Food>> foodList(@RequestParam(defaultValue = "1") int page,
                                        @RequestParam(defaultValue = "10") int size,
                                        @RequestParam(required = false) String keyword,
                                        @RequestParam(required = false) String startDate,
                                        @RequestParam(required = false) String endDate) {
        LambdaQueryWrapper<Food> w = StatsServiceImpl.foodWrapper(keyword,
                StatsServiceImpl.parseDay(startDate, false), StatsServiceImpl.parseDay(endDate, true));
        w.orderByDesc(Food::getCreateTime);
        IPage<Food> result = foodMapper.selectPage(new Page<>(page, clampSize(size)), w);
        Map<Long, String> storeNames = new HashMap<>();
        result.getRecords().forEach(f -> f.setStoreName(
                storeNames.computeIfAbsent(f.getStoreId(), id -> {
                    if (id == null) return null;
                    FoodStore s = foodStoreMapper.selectById(id);
                    return s != null ? s.getName() : null;
                })));
        return Result.success(result);
    }

    @GetMapping("/food/store/list")
    public Result<IPage<FoodStore>> foodStoreList(@RequestParam(defaultValue = "1") int page,
                                                  @RequestParam(defaultValue = "10") int size,
                                                  @RequestParam(required = false) String keyword,
                                                  @RequestParam(required = false) String startDate,
                                                  @RequestParam(required = false) String endDate) {
        LambdaQueryWrapper<FoodStore> w = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.trim().isEmpty()) {
            String k = keyword.trim();
            w.and(x -> x.like(FoodStore::getName, k)
                    .or().like(FoodStore::getLocation, k)
                    .or().like(FoodStore::getCategory, k));
        }
        Date start = StatsServiceImpl.parseDay(startDate, false);
        Date end = StatsServiceImpl.parseDay(endDate, true);
        if (start != null) w.ge(FoodStore::getCreateTime, start);
        if (end != null) w.le(FoodStore::getCreateTime, end);
        w.orderByDesc(FoodStore::getCreateTime);
        return Result.success(foodStoreMapper.selectPage(new Page<>(page, clampSize(size)), w));
    }

    // ==================== 仪表盘数据总览 ====================

    /** 单个模块总览 */
    @GetMapping("/stats/overview")
    public Result<Map<String, Object>> overview(@RequestParam String module,
                                                @RequestParam(required = false) String startDate,
                                                @RequestParam(required = false) String endDate,
                                                HttpSession session) {
        User operator = (User) session.getAttribute(Constants.SESSION_USER);
        if (operator == null) return Result.error(401, "请先登录");
        Long staffId = Constants.ROLE_STAFF.equals(operator.getRole()) ? operator.getId() : null;
        try {
            return Result.success(statsService.moduleOverview(module, staffId, startDate, endDate));
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        }
    }

    /** 一次拉取全部四个模块，供仪表盘首屏渲染 */
    @GetMapping("/stats/overviewAll")
    public Result<Map<String, Object>> overviewAll(@RequestParam(required = false) String startDate,
                                                   @RequestParam(required = false) String endDate,
                                                   HttpSession session) {
        User operator = (User) session.getAttribute(Constants.SESSION_USER);
        if (operator == null) return Result.error(401, "请先登录");
        Long staffId = Constants.ROLE_STAFF.equals(operator.getRole()) ? operator.getId() : null;
        Map<String, Object> all = new LinkedHashMap<>();
        for (String module : Arrays.asList("spot", "route", "hotel", "food")) {
            all.put(module, statsService.moduleOverview(module, staffId, startDate, endDate));
        }
        return Result.success(all);
    }

    private static int clampSize(int size) {
        if (size < 1) return 10;
        return Math.min(size, MAX_SIZE);
    }

}
