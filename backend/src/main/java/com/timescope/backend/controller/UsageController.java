package com.timescope.backend.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.timescope.backend.repository.AppLogRepository;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class UsageController {
    private final AppLogRepository repo;
    public UsageController(AppLogRepository repo) { this.repo = repo; }

    @GetMapping("/usage")
    public List<Map<String, Object>> getUsage(@RequestParam String date) {
        List<Object[]> results = repo.findUsageByDate(date);
        List<Map<String, Object>> response = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("appName", row[0]);
            Number count = (Number) row[1];
            map.put("minutes", Math.round(count.longValue() * 0.5));
            response.add(map);
        }
        return response;
    }
}