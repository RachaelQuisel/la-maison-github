# Property Inspector Checkoff List

The portfolio uses this title for the interactive checklist feature. Its underlying public source is the [Airtable AI Webinar repository](https://github.com/RachaelQuisel/Airtable-AI-Webinar), whose worked example is the Family Neighborhood task interface.

## Process and source

1. Start with the staff member’s job and a native task-list baseline.
2. Generate a custom Airtable interface with Omni.
3. Review the rendered result and export the React source.
4. Refine the source through two deliberate passes, checking layout, keyboard focus, reduced motion, task controls, and the explanation of progress.
5. Map the source to the intended tables and fields, save it in Airtable, and verify actual record writes after refresh.

The [case study](https://github.com/RachaelQuisel/Airtable-AI-Webinar/blob/main/docs/family-neighborhood-case-study.md) explains the four versions. The [setup guide](https://github.com/RachaelQuisel/Airtable-AI-Webinar/blob/main/family-neighborhood/README.md), field map, source file, fixture, and build prompts establish the implementation path.

The supplied source uses nine tables and 48 demo field IDs. A property-inspection adaptation needs its own property, visit, task, completion, and permission mapping. The linked demo’s family/case-task data is not an already deployed property-inspection backend. Contractor dispatch is a separate workflow.
