package com.redtourism.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.redtourism.entity.Food;
import com.redtourism.entity.FoodStore;
import java.util.List;

public interface FoodService extends IService<Food> {
    IPage<Food> listFoods(int page, int size, String category, String keyword, String orderBy);
    Food getDetail(Long id);
    List<FoodStore> listStores(String keyword, String startDate, String endDate);
    default List<FoodStore> listStores(String keyword) {
        return listStores(keyword, null, null);
    }
    FoodStore getStoreDetail(Long id);
    boolean saveStore(FoodStore store);
    boolean deleteStore(Long id);
}
