package com.timescope.backend.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import com.timescope.backend.repository.AppLogRepository;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class SummaryController {
    private final AppLogRepository repo;
    private final RestTemplate restTemplate = new RestTemplate();

    public SummaryController(AppLogRepository repo) { this.repo = repo; }

    @GetMapping("/summary")
    public String getSummary(@RequestParam String date) {
        List<Object[]> results = repo.findUsageByDate(date);
        
        StringBuilder usageText = new StringBuilder("Here is my app usage for today:\n");
        for (Object[] row : results) {
            Number count = (Number) row[1];
            long minutes = Math.round(count.longValue() * 0.5);
            usageText.append("- ").append(row[0]).append(": ").append(minutes).append(" minutes\n");
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", "llama3");
        payload.put("prompt", usageText + "\nGive me a short, friendly plain-English summary of how I spent my time today and one productivity tip.");
        payload.put("stream", false);

        Map response = restTemplate.postForObject("http://localhost:11434/api/generate", payload, Map.class);
        return response != null ? (String) response.get("response") : "Could not generate summary.";
    }
}