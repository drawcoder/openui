root = VLayout([title, gauge])
title = Text("System Health Score", "large")
gauge = GaugeChart(data.readings, 0, 100)