---
tags:
  - moc
updated: 2026-09-22
---
# Features

## Sections (bottom bar and side menu)
- **Today**: [[Today]] · [[Week]] · [[Time tracking]]
- **Do**: [[Tasks]] · [[Projects]] · [[Goals]] · [[Habits]] · [[Capabilities]]
- **Money**: [[Money]] · [[Resources and electricity]]
- **Body**: [[Health]] · [[Food]] · [[Samsung Health]]
- **Spirit**: [[Spirit and prayers]] · [[Reminders]]
- **Tools**: [[Notes]] · [[Calendar]] · [[Daily review]]

## Everywhere
[[Quick add]] · [[Hub and character sheet]] · [[Settings]] · [[Usage insights]] · [[Intro page]]

```mermaid
graph LR
  Task --> Project --> Goal
  Task --> Goal
  Habit -->|category| Area[Health / Money / Spirit]
  Spending --> LeftToSpend[Left to spend]
  Reading --> Tier[Electricity tier]
  Prayer --> Streak[RPG streak]
```
