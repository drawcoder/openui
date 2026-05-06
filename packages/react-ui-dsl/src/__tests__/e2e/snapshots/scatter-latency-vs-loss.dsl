root = VLayout([title, chart])
title = Text("Latency vs Packet Loss – Core Routers", "large")
chart = ScatterChart([data.scatterSeries], data.xLabel, data.yLabel)