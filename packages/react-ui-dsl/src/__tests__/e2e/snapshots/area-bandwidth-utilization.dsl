root = VLayout([header, chart])
header = Text("Bandwidth Utilization Over 24 Hours", "large")
chart = AreaChart(data.labels, data.series, "smooth", "Time", "Bandwidth (Mbps)")