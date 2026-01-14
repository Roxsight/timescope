package com.timescope.agent;

import okhttp3.*;
import java.time.Instant;

public class App {
    private static final String SERVER_URL = "http://localhost:3000/heartbeat";
    private static final OkHttpClient client = new OkHttpClient();

    public static void main(String[] args) throws Exception {
        System.out.println("TimeScope Agent starting...");
        
        while (true) {
            String timestamp = Instant.now().toString();
            System.out.println("Sending heartbeat: " + timestamp);
            
            RequestBody body = RequestBody.create(
                "{\"timestamp\":\"" + timestamp + "\"}", 
                MediaType.parse("application/json")
            );
            
            Request request = new Request.Builder()
                .url(SERVER_URL)
                .post(body)
                .build();
            
            try (Response response = client.newCall(request).execute()) {
                System.out.println("Response: " + response.code());
            } catch (Exception e) {
                System.out.println("Failed to send heartbeat: " + e.getMessage());
            }
            
            Thread.sleep(2000);
        }
    }
}
