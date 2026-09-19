package com.redtourism.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.redtourism.common.Result;
import com.redtourism.entity.Food;
import com.redtourism.entity.FoodStore;
import com.redtourism.service.FoodService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/food")
public class FoodController {

    @Autowired
    private FoodService foodService;

    @GetMapping("/list")
    public Result<IPage<Food>> list(@RequestParam(defaultValue = "1") int page,
                                     @RequestParam(defaultValue = "10") int size,
                                     @RequestParam(required = false) String category,
                                     @RequestParam(required = false) String keyword,
                                     @RequestParam(required = false) String orderBy) {
        return Result.success(foodService.listFoods(page, size, category, keyword, orderBy));
    }

    @GetMapping("/detail")
    public Result<Food> detail(@RequestParam Long id) {
        return Result.success(foodService.getDetail(id));
    }

    @GetMapping("/stores")
    public Result<List<FoodStore>> stores(@RequestParam(required = false) String keyword,
                                          @RequestParam(required = false) String startDate,
                                          @RequestParam(required = false) String endDate) {
        return Result.success(foodService.listStores(keyword, startDate, endDate));
    }
    @GetMapping("/storeDetail")
    public Result<FoodStore> storeDetail(@RequestParam Long id) {
        return Result.success(foodService.getStoreDetail(id));
    }

    @GetMapping("/categories")
    public Result<List<String>> categories() {
        List<String> categories = java.util.Arrays.asList(
                "酸汤系列", "辣子系列", "烧烤", "米粉面食", "小吃", "特色火锅", "民族菜");
        return Result.success(categories);
    }
}
