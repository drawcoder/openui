root = VLayout([actionList])
actionList = List(@Each(data.list.items, "item", Text(item)), data.list.title)