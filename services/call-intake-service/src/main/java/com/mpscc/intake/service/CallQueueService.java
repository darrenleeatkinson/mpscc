package com.mpscc.intake.service;

import com.mpscc.intake.model.CallInbound;
import org.springframework.stereotype.Service;
import java.util.Deque;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
public class CallQueueService {

    private static final int MAX_QUEUE = 200;
    private final Deque<CallInbound> queue = new ConcurrentLinkedDeque<>();

    public void enqueue(CallInbound call) {
        if (queue.size() < MAX_QUEUE) {
            queue.addLast(call);
        }
    }

    public Optional<CallInbound> pollNext() {
        return Optional.ofNullable(queue.pollFirst());
    }

    public int size() {
        return queue.size();
    }

    public List<CallInbound> snapshot(int limit) {
        return queue.stream().limit(limit).toList();
    }
}
