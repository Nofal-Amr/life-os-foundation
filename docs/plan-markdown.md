# Plan markdown

A simple way to write a plan that Life OS can import: a goal, its projects and tasks, habits and notes. Any AI chat (ChatGPT, Claude or another) can write it, and so can you.

Import it at **Projects → Import a plan** (`/import-plan`). Paste or upload the markdown, look over the preview, untick anything you don't want, choose when Week 1 starts, and press **Create**. Life OS doesn't call any AI service. You paste the prompt into your own chat.

## The format

| Write                                          | Becomes                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `# Goal: Land a data role @2026-12-11 #career` | The goal, with its deadline and area. Only one goal per plan. A plain `# Title` works too. |
| Text right under the goal                      | The goal's description                                                                     |
| `Deadline: 2026-12-11`, `Area: #career`        | Also set the goal's deadline and area                                                      |
| `## Project: Portfolio !high`                  | A project. Any `##` heading that isn't Habits, Notes or a week is a project.               |
| Text right under a project                     | The project's description                                                                  |
| `### Week 1` (or `## Week 1`)                  | A week section. Its tasks are due on the last day of that week.                            |
| `- [ ] Task`                                   | A task. `- [x]` is a task already done. `-`, `*`, `+` and `1.` bullets work too.           |
| Indented `- [ ] Step`                          | A step of the task above it                                                                |
| Indented text under a task                     | The task's description                                                                     |
| `## Habits` with `- Read 20 pages daily`       | Habits. Write `weekly` for a weekly one; daily is the default.                             |
| `## Notes`                                     | Everything under it becomes one note, tagged `plan`                                        |

On a task, project or goal line:

| Token                                | Meaning                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `@2026-11-20`                        | Due on that date. Only YYYY-MM-DD is read.                                                              |
| `@d10`                               | Day 10 of the plan, where day 1 is the start date you choose                                            |
| `!low` `!medium` `!high` `!critical` | Priority (`!urgent` means critical)                                                                     |
| `#career`                            | An area. The goal's first area becomes its category, and task areas are kept in the task's description. |
| `~30m` `~2h` `~1d`                   | Estimate (a day is 8 hours)                                                                             |

### Dates are never guessed

- A date that isn't an exact YYYY-MM-DD, such as `@20/11/2026`, `@tomorrow` or `@2026-02-30`, is left out. You see a warning with its line number.
- "Week N" and `@dN` only become dates from the start date you pick in the importer.
  - Week 1 runs from the start date to six days later.
  - A task in Week N is due on that week's last day, and starts on its first day.
- Without a start date they stay undated.

### How things are linked

- Every task is linked to the goal and to its project.
- Projects show "Part of the goal: …" in their description. Projects have no goal field, so the tasks are the link.
- Unticking a project in the preview unticks its tasks too. A step is only made if its task is.

## Prompt: make a plan

Copy this into your AI chat, fill in the brackets, then paste the answer into the importer.

```text
You are helping me plan in Life OS, a calm personal planner. Make me a realistic plan.

My goal: [WRITE YOUR GOAL]
Deadline: [YYYY-MM-DD]
Hours I can give per week: [NUMBER]
What I already have or know: [OPTIONAL]

Fit the work into the hours per week I gave. Split it into a few projects, each with tasks grouped by week. Add at most three habits that support the goal.

Answer ONLY with the plan in this markdown format, nothing before or after it:

# Goal: <the goal> @<deadline as YYYY-MM-DD> #<area>
<one or two sentences on what done looks like>

## Project: <project name> !<low|medium|high|critical>
### Week 1
- [ ] <task, starting with a verb> ~<estimate like 30m or 2h>
  - [ ] <optional small first step>
### Week 2
- [ ] <task> @d10 ~1h

## Habits
- <habit> daily
- <habit> weekly

## Notes
<anything worth remembering: resources, links, advice>

Rules:
- Dates are YYYY-MM-DD only. Use "### Week N" sections or "@dN" (day N of the plan, day 1 = start) instead of guessing calendar dates.
- One task per line, starting with "- [ ] ". Keep tasks small enough to start in one sitting.
- Use "!high" only for the few tasks that matter most.
- Areas are single words after "#", like #career or #health.
```

## Prompt: turn a checklist into a plan

```text
Turn the checklist below into Life OS plan markdown. Keep my wording where you can, don't add tasks I didn't ask for, and group related items into projects. Keep any dates I wrote, as YYYY-MM-DD.

Checklist:
[PASTE YOUR CHECKLIST HERE]

Answer ONLY with the plan in this markdown format, nothing before or after it:

# Goal: <the goal> @<deadline as YYYY-MM-DD> #<area>
<one or two sentences on what done looks like>

## Project: <project name> !<low|medium|high|critical>
### Week 1
- [ ] <task, starting with a verb> ~<estimate like 30m or 2h>
  - [ ] <optional small first step>
### Week 2
- [ ] <task> @d10 ~1h

## Habits
- <habit> daily
- <habit> weekly

## Notes
<anything worth remembering: resources, links, advice>

Rules:
- Dates are YYYY-MM-DD only. Use "### Week N" sections or "@dN" (day N of the plan, day 1 = start) instead of guessing calendar dates.
- One task per line, starting with "- [ ] ". Keep tasks small enough to start in one sitting.
- Use "!high" only for the few tasks that matter most.
- Areas are single words after "#", like #career or #health.
```

## Example: a 4-week career plan

```markdown
# Goal: Land a junior data analyst role #career

Ready to apply with a portfolio, a sharp CV and steady applications.

## Project: Skills refresh !high

### Week 1

- [ ] Finish the SQL joins and window functions course ~4h
  - [ ] Watch the first lesson
- [ ] Do 10 practice queries on a public dataset ~2h

### Week 2

- [ ] Build one dashboard in Power BI ~3h #portfolio

## Project: Portfolio

### Week 2

- [ ] Pick two datasets for case studies ~1h

### Week 3

- [ ] Write case study 1 with charts and findings ~4h !high
- [ ] Write case study 2 ~4h
- [ ] Publish both on GitHub ~1h

## Project: Applications

### Week 1

- [ ] Update the CV with numbers from past work ~2h !high
- [ ] Refresh the LinkedIn headline and about ~1h

### Week 4

- [ ] Apply to 10 roles that fit ~5h
- [ ] Ask two people for a referral ~30m
- [ ] Prepare answers for five common interview questions ~2h

## Habits

- Practice SQL for 30 minutes daily
- Review applications and follow up weekly

## Notes

Free datasets: Kaggle, data.gov.
Keep each case study to one page of findings.
```

This sample is also behind the importer's **Try a sample** button, and the tests import it (`src/data/planImport.test.ts`). It makes 1 goal, 3 projects, 13 tasks (one of them a step), 2 habits and 1 note.

## Code

- Parser: `src/lib/planMarkdown.ts`
- Prompts and the sample: `src/lib/planPrompts.ts`
- Import: `src/data/planImport.ts`
- Page: `src/routes/_authenticated/import-plan.tsx`
