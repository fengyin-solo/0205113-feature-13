package com.redtourism.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.redtourism.entity.Food;
import com.redtourism.entity.FoodStore;
import com.redtourism.mapper.FoodMapper;
import com.redtourism.mapper.FoodStoreMapper;
import com.redtourism.service.FoodService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class FoodServiceImpl extends ServiceImpl<FoodMapper, Food> implements FoodService {

    @Autowired
    private FoodStoreMapper foodStoreMapper;

    @Override
    public IPage<Food> listFoods(int page, int size, String category, String keyword, String orderBy) {
        LambdaQueryWrapper<Food> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(category)) {
            wrapper.eq(Food::getCategory, category);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Food::getName, keyword)
                    .or().like(Food::getDescription, keyword));
        }
        if ("price".equals(orderBy)) {
            wrapper.orderByAsc(Food::getPrice);
        } else {
            wrapper.orderByDesc(Food::getCreateTime);
        }
        return page(new Page<>(page, size), wrapper);
    }

    @Override
    public Food getDetail(Long id) {
        return getById(id);
    }

    @Override
    public List<FoodStore> listStores(String keyword, String startDate, String endDate) {
        LambdaQueryWrapper<FoodStore> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            wrapper.and(w -> w.like(FoodStore::getName, kw)
                    .or().like(FoodStore::getLocation, kw)
                    .or().like(FoodStore::getCategory, kw));
        }
        if (startDate != null && !startDate.trim().isEmpty()) {
            try {
                wrapper.ge(FoodStore::getCreateTime,
                        java.sql.Timestamp.valueOf(java.time.LocalDate.parse(startDate.trim()).atStartOfDay()));
            } catch (Exception ignored) {}
        }
        if (endDate != null && !endDate.trim().isEmpty()) {
            try {
                wrapper.le(FoodStore::getCreateTime,
                        java.sql.Timestamp.valueOf(
                                java.time.LocalDate.parse(endDate.trim()).atTime(java.time.LocalTime.MAX)));
            } catch (Exception ignored) {}
        }
        wrapper.orderByDesc(FoodStore::getCreateTime);
        return foodStoreMapper.selectList(wrapper);
    }

    @Override
    public FoodStore getStoreDetail(Long id) {
        return foodStoreMapper.selectById(id);
    }

    @Override
    public boolean saveStore(FoodStore store) {
        if (store.getId() != null) {
            return foodStoreMapper.updateById(store) > 0;
        }
        return foodStoreMapper.insert(store) > 0;
    }

    @Override
    public boolean deleteStore(Long id) {
        return foodStoreMapper.deleteById(id) > 0;
    }
}
