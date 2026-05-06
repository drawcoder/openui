root = VLayout([regionSelector, currentRegion])
regionSelector = Select(data.options, data.defaultValue, true)
currentRegion = Text("Current selection: " + data.defaultValue)