package com.timescope.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.timescope.backend.model.AppLog;
import com.timescope.backend.repository.AppLogRepository;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class LogController {
    private final AppLogRepository repo;
    public LogController(AppLogRepository repo) { this.repo = repo; }

    @PostMapping("/logs")
    public AppLog createLog(@RequestBody AppLog log) {
        if (log.getTimestamp() == null) log.setTimestamp(java.time.LocalDateTime.now().toString());
        return repo.save(log);
    }

    @DeleteMapping("/reset")
    public ResponseEntity<?> reset(@RequestParam String date) {
        repo.deleteByTimestampStartingWith(date);
        return ResponseEntity.ok().build();
    }
}