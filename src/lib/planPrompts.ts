/**
 * Ready-made prompts to paste into your own AI chat (ChatGPT, Claude or any
 * other). Life OS never calls an AI service itself: you copy the prompt, the
 * chat answers in plan markdown, and you paste the answer into the importer.
 * The same text is in docs/plan-markdown.md.
 */

export const PLAN_FORMAT_RULES = `Answer ONLY with the plan in this markdown format, nothing before or after it:

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
- Areas are single words after "#", like #career or #health.`;

export type PlanPrompt = { id: string; label: string; text: string };

export const PLAN_PROMPTS: PlanPrompt[] = [
  {
    id: "make-plan",
    label: "Make a plan",
    text: `You are helping me plan in Life OS, a calm personal planner. Make me a realistic plan.

My goal: [WRITE YOUR GOAL]
Deadline: [YYYY-MM-DD]
Hours I can give per week: [NUMBER]
What I already have or know: [OPTIONAL]

Fit the work into the hours per week I gave. Split it into a few projects, each with tasks grouped by week. Add at most three habits that support the goal.

${PLAN_FORMAT_RULES}`,
  },
  {
    id: "checklist",
    label: "Turn a checklist into a plan",
    text: `Turn the checklist below into Life OS plan markdown. Keep my wording where you can, don't add tasks I didn't ask for, and group related items into projects. Keep any dates I wrote, as YYYY-MM-DD.

Checklist:
[PASTE YOUR CHECKLIST HERE]

${PLAN_FORMAT_RULES}`,
  },
];

/** A sample 4-week career plan, used in the docs, the importer and tests. */
export const SAMPLE_CAREER_PLAN = `# Goal: Land a junior data analyst role #career
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
`;
