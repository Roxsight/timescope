package com.timescope.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.timescope.backend.model.AppLog;

public interface AppLogRepository extends JpaRepository<AppLog, Long> {
    @Query(value = "SELECT app_name, COUNT(*) FROM app_logs WHERE SUBSTR(timestamp, 1, 10) = :date GROUP BY app_name", nativeQuery = true)
    List<Object[]> findUsageByDate(@Param("date") String date);

    @Transactional
    void deleteByTimestampStartingWith(String date);
}