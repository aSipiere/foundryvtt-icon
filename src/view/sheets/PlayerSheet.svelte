<script>
    import { getContext, onMount } from "svelte";
    import { updateDoc } from "../actions/update";
    import { handleSortEmbeddedItem, localize } from "../../util/misc";
    import Portrait from "../components/Portrait.svelte";
    import { dropDocs } from "../actions/drop";
    import CombatHud from "../components/combat/CombatHud.svelte";
    import StatsDisplay from "../components/combat/StatsDisplay.svelte";
    import { dragAsDoc } from "../actions/drag";
    import Progression from "./player/Progression.svelte";
    import Narrative from "./player/Narrative.svelte";
    import { TAB_STORES } from "../../util/stores/tabs";
    import Notes from "./player/Notes.svelte";
    import Loadout from "./player/Loadout.svelte";
    import { equipBond, equipJob } from "../../util/loadout";

    let actor = getContext("tjs_actor");
    let doc = actor; // Alias
    // Set our tabs
    const tabs = ["ICON.Narrative", "ICON.Notes", "ICON.Combat", "ICON.Loadout", "ICON.Progression"].map((s) => ({
        label: localize(s),
        key: s,
    }));
    let selected_tab = TAB_STORES.get($actor.uuid, "ICON.Narrative");

    // Compendium data for dropdowns
    const COLOR_TO_CLASS = { Red: "Stalwart", Yellow: "Vagabond", Blue: "Wright", Green: "Mendicant" };
    const CLASS_TO_COLOR = { Stalwart: "Red", Vagabond: "Yellow", Wright: "Blue", Mendicant: "Green" };
    const CLASS_NAMES = ["Stalwart", "Vagabond", "Wright", "Mendicant"];

    let allBonds = [];
    let allJobs = [];
    let selectedClass = "";

    // Derive current selections from actor state (match by name since embedded _id differs from compendium _id)
    $: currentBondName = $actor.system.bond?.name ?? "";
    $: currentJobName = $actor.system.job?.name ?? "";
    $: currentClass = $actor.system.job ? COLOR_TO_CLASS[$actor.system.job.system.class.color] ?? "" : selectedClass;
    $: filteredJobs = currentClass ? allJobs.filter(j => j.system.class.color === CLASS_TO_COLOR[currentClass]) : [];

    // Keep selectedClass in sync with actor's job
    $: if ($actor.system.job) {
        selectedClass = COLOR_TO_CLASS[$actor.system.job.system.class.color] ?? "";
    }

    onMount(async () => {
        const bondPack = game.packs.get("icon.bonds");
        const jobPack = game.packs.get("icon.jobs");
        if (bondPack) allBonds = (await bondPack.getDocuments()).sort((a, b) => a.name.localeCompare(b.name));
        if (jobPack) allJobs = (await jobPack.getDocuments()).sort((a, b) => a.name.localeCompare(b.name));

        // Initialize selectedClass from current job
        if ($actor.system.job) {
            selectedClass = COLOR_TO_CLASS[$actor.system.job.system.class.color] ?? "";
        }
    });

    async function onBondSelected(event) {
        const bondName = event.target.value;
        if (!bondName) return;
        const compendiumBond = allBonds.find(b => b.name === bondName);
        if (!compendiumBond) return;

        let [owned] = await $actor.createEmbeddedDocuments("Item", [
            foundry.utils.duplicate(compendiumBond.toObject(true)),
        ]);
        await equipBond($actor, owned);
    }

    async function onClassSelected(event) {
        selectedClass = event.target.value;
    }

    async function onJobSelected(event) {
        const jobName = event.target.value;
        if (!jobName) return;
        const compendiumJob = allJobs.find(j => j.name === jobName);
        if (!compendiumJob) return;

        let [owned] = await $actor.createEmbeddedDocuments("Item", [
            foundry.utils.duplicate(compendiumJob.toObject(true)),
        ]);
        await equipJob($actor, owned);
    }

    /**
     * Add dropped items to this actor
     * @param {Item} doc The dropped document
     * @param {DropEvent} event The drop event
     */
    async function handleDrop(doc, event) {
        // Destroy old job or bond
        if (doc instanceof Item) {
            if (doc.actor === $actor) {
                // Attempt resorting
                await handleSortEmbeddedItem(doc, event);
            } else {
                let [owned_doc] = await $actor.createEmbeddedDocuments("Item", [
                    foundry.utils.duplicate(doc.toObject(true)),
                ]);
                if (owned_doc.type === "bond") await equipBond($actor, owned_doc);
                if (owned_doc.type === "job") await equipJob($actor, owned_doc);
            }
        }
    }

    /**
     * Test whether to allow the specified drop
     * @param {Item} doc The dropped document
     */
    function allowDrop(doc) {
        return ["bond-power", "bond", "job", "ability", "relic"].includes(doc.type);
    }
</script>

<main use:dropDocs={{ handle: handleDrop, allow: allowDrop }}>
    <!-- Sheet Header -->
    <header>
        <Portrait style="grid-area: pic" />
        <input style="grid-area: name" type="text" use:updateDoc={{ doc, path: "name" }} />
        <input
            style="grid-area: player_name"
            type="text"
            use:updateDoc={{ doc, path: "system.player_name" }}
            placeholder="Player Name"
        />
        <div style="grid-area: narr" class="header-information">
            <span><strong>{localize("ICON.Kintype")}:</strong></span>
            <input type="text" use:updateDoc={{ doc, path: "system.kin" }} />
            <span><strong>{localize("ICON.Culture")}:</strong> </span>
            <input type="text" use:updateDoc={{ doc, path: "system.culture" }} />
            <span>
                <strong>{localize("ICON.Bonds.Bond")}:</strong>
            </span>
            <span class="dropdown-cell">
                <select value={currentBondName} on:change={onBondSelected}>
                    <option value="">-- Select Bond --</option>
                    {#each allBonds as bond}
                        <option value={bond.name}>{bond.name}</option>
                    {/each}
                </select>
                {#if $actor.system.bond}
                    <i
                        class="fas fa-edit"
                        style="cursor: pointer"
                        on:click={() => $actor.system.bond?.sheet?.render(true, { focus: true })}
                    />
                {/if}
            </span>
        </div>
        <div style="grid-area: comb" class="header-information">
            <span><strong>{localize("ICON.Class")}:</strong></span>
            <span class="dropdown-cell">
                <select value={currentClass} on:change={onClassSelected}>
                    <option value="">-- Select Class --</option>
                    {#each CLASS_NAMES as cls}
                        <option value={cls}>{cls}</option>
                    {/each}
                </select>
            </span>
            <span>
                <strong>{localize("ICON.Job")}:</strong>
            </span>
            <span class="dropdown-cell">
                <select value={currentJobName} on:change={onJobSelected} disabled={!currentClass}>
                    <option value="">-- Select Job --</option>
                    {#each filteredJobs as job}
                        <option value={job.name}>{job.name}</option>
                    {/each}
                </select>
                {#if $actor.system.job}
                    <i
                        class="fas fa-edit"
                        style="cursor: pointer"
                        on:click={() => $actor.system.job.sheet.render(true, { focus: true })}
                    />
                {/if}
            </span>
            <span>{localize("ICON.Level")}:</span>
            <input type="number" use:updateDoc={{ doc, path: "system.level" }} />
        </div>

        <div class="tabs" style="grid-area: tabs">
            <!-- Sheet Tab Navigation -->
            <!--<Tabs {tabs} horizontal={false} bind:selected={$selected_tab} />-->
            {#each tabs as tab}
                <button class="tab" class:active={tab.key === $selected_tab} on:click={() => ($selected_tab = tab.key)}
                    >{tab.label}</button
                >
            {/each}
        </div>
    </header>

    <!-- Sheet Body -->
    {#if $selected_tab == "ICON.Narrative"}
        <Narrative />
    {:else if $selected_tab === "ICON.Combat"}
        <section class="sheet-body combat">
            {#if $actor.system.job}
                <StatsDisplay style="grid-area: stats" />
                <CombatHud />
            {:else}
                <span>
                    {localize("ICON.Tutorial.AddJob")}
                </span>
            {/if}
        </section>
    {:else if $selected_tab == "ICON.Progression"}
        <Progression />
    {:else if $selected_tab == "ICON.Notes"}
        <Notes />
    {:else if $selected_tab == "ICON.Loadout"}
        <Loadout />
    {:else}
        <span>Tab does not exist</span>
    {/if}
</main>

<style lang="scss">
    main {
        height: 100%;
        overflow: auto;
        display: flex;
        flex-direction: column;
    }

    header {
        flex: 0 1 auto;
        display: grid;
        grid-template:
            "pic    name   player_name tabs" 20px
            "pic    narr   comb        tabs" auto / 110px 1fr 1fr 1fr;
        gap: 5px;
        padding: 10px;

        .header-information {
            display: grid;
            grid-template: 1fr 1fr 1fr / 1fr 1fr;
            align-items: center;

            .dropdown-cell {
                display: flex;
                align-items: center;
                gap: 4px;

                select {
                    flex: 1;
                    min-width: 0;
                }
            }
        }

        .tabs {
            display: grid;
            height: 100%;
            grid-template: repeat(3, 1fr) / repeat(2, 1fr);

            button {
                line-height: 1em;
            }
        }
    }

    .sheet-body {
        padding: 5px 5px 0px 5px;
        flex: 1 0 auto;
        max-height: calc(100% - 162px);
    }
</style>
