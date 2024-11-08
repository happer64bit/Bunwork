To reproduce the benchmark results for your Bun server, follow these steps:

### Step 1: Start the Bun Server
Navigate to the `hello-world` example directory and start the server with Bun:

```bash
cd examples/hello-world
bun index.ts
```

### Step 2: Run the Benchmark Test
In a separate terminal, use `oha` to perform the benchmarking test against the server:

```bash
oha http://localhost:3000
```

### Sample Benchmark Results (Summary)
Below is an example output from the benchmark:

- **Success Rate**: 100.00%
- **Total Time**: 15.7125 seconds
- **Requests per Second**: 1909.31
- **Data Transfer**: 380.86 KiB total

### Response Time Analysis
- **Fastest Response**: 0.0137 seconds
- **Slowest Response**: 0.2810 seconds
- **Average Response**: 0.0261 seconds

#### Response Time Histogram:
Most responses fall between 0.014 and 0.040 seconds, with occasional slower responses up to 0.281 seconds.

#### Response Time Distribution:
- **10%** of requests responded within **0.0185 seconds**
- **50%** (median) responded within **0.0234 seconds**
- **99%** of requests completed within **0.0909 seconds**

#### Status Code Distribution:
- **[200]**: 30,000 responses (all successful)

This setup can help you evaluate server performance with a high success rate and quick response times.
