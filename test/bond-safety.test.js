import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * These tests validate that the compiled output (index.js) does not contain
 * unsafe bond property accesses that would cause TypeErrors when a player
 * character has no equipped bond item.
 *
 * Background: The actor data model defines system.bond as a StringField
 * (initial: "Arkenlord"). During prepareDerivedData(), this string is
 * overwritten with the actual bond Item document or undefined. However,
 * Svelte's compiler can hoist expressions outside of {#if} guards, so
 * direct property access like `.bond.system` or `.bond.name` will throw
 * when bond is still a string or undefined.
 */

const indexPath = resolve(import.meta.dirname, "..", "index.js");
const indexContent = readFileSync(indexPath, "utf-8");

describe("Bond access safety in compiled output", () => {
    it("should not contain unsafe .bond.system access patterns", () => {
        // Match .bond.system but NOT .bond?.system
        // This regex looks for .bond. followed by system without optional chaining
        const unsafePattern = /\.bond\.system/g;
        const matches = [...indexContent.matchAll(unsafePattern)];

        // Filter out matches that are actually safe (preceded by ?.)
        const unsafeMatches = matches.filter((m) => {
            // Check if the match is preceded by ?. (i.e., .bond?.system would show as .bond.system in our regex)
            const idx = m.index;
            const before = indexContent.substring(Math.max(0, idx - 1), idx);
            // If character before .bond is ?, it's actually ?.bond which is fine
            // But we're matching ".bond.system" - we need to check if there's a ? before .system
            const fullContext = indexContent.substring(idx, idx + 20);
            return !fullContext.startsWith(".bond?.system");
        });

        expect(
            unsafeMatches.length,
            `Found ${unsafeMatches.length} unsafe .bond.system accesses (without optional chaining). ` +
                `These will throw TypeError when bond is a string or undefined. ` +
                `Use .bond?.system instead.`
        ).toBe(0);
    });

    it("should not contain unsafe .bond.name access patterns", () => {
        const unsafePattern = /\.bond\.name/g;
        const matches = [...indexContent.matchAll(unsafePattern)];

        const unsafeMatches = matches.filter((m) => {
            const fullContext = indexContent.substring(m.index, m.index + 15);
            return !fullContext.startsWith(".bond?.name");
        });

        expect(
            unsafeMatches.length,
            `Found ${unsafeMatches.length} unsafe .bond.name accesses. Use .bond?.name instead.`
        ).toBe(0);
    });

    it("should not contain unsafe .bond.sheet access patterns", () => {
        const unsafePattern = /\.bond\.sheet/g;
        const matches = [...indexContent.matchAll(unsafePattern)];

        const unsafeMatches = matches.filter((m) => {
            const fullContext = indexContent.substring(m.index, m.index + 16);
            return !fullContext.startsWith(".bond?.sheet");
        });

        expect(
            unsafeMatches.length,
            `Found ${unsafeMatches.length} unsafe .bond.sheet accesses. Use .bond?.sheet instead.`
        ).toBe(0);
    });

    it("should use optional chaining in prepareDerivedData bond resolution", () => {
        // The data model's prepareDerivedData uses bond?.system which is safe
        expect(indexContent).toContain("this.bond?.system.strain_cap");
        expect(indexContent).toContain("this.bond?.system.effort_cap");
    });
});

describe("Bond data model", () => {
    it("should handle all bond states without throwing", () => {
        // Simulate the different states system.bond can be in:
        const bondStates = [
            { name: "initial string value", bond: "Arkenlord" },
            { name: "no bond (undefined)", bond: undefined },
            { name: "no bond (null)", bond: null },
            {
                name: "resolved bond item",
                bond: {
                    name: "Brave",
                    type: "bond",
                    system: {
                        second_wind: "<p>Regain all effort</p>",
                        special_ability: "<p>Some ability</p>",
                        description: "<p>A brave bond</p>",
                        ideals: ["Be courageous", "Stand firm"],
                        strain_cap: 5,
                        effort_cap: 3,
                        equipped: true,
                    },
                    sheet: { render: () => {} },
                },
            },
        ];

        for (const { name, bond } of bondStates) {
            // These are the access patterns used in the Svelte templates.
            // None should throw regardless of what bond is.
            expect(() => {
                // Narrative.svelte guard pattern
                const safeBond = typeof bond === "object" ? bond : null;

                // Accessing properties safely (as the templates now do)
                const bondName = safeBond?.name ?? "";
                const secondWind = safeBond?.system?.second_wind ?? "";
                const specialAbility = safeBond?.system?.special_ability ?? "";
                const description = safeBond?.system?.description ?? "";
                const ideals = safeBond?.system?.ideals ?? [];
                const sheet = safeBond?.sheet;

                // Progression.svelte pattern
                const progIdeals = bond?.system?.ideals ?? [];

                // PlayerSheet.svelte pattern
                const hasBond = typeof bond === "object" && bond;
                const displayName = hasBond ? bond?.name ?? "" : "None";
            }, `Bond state "${name}" should not throw`).not.toThrow();
        }
    });

    it("typeof guard should correctly filter string bond values", () => {
        const stringBond = "Arkenlord";
        expect(typeof stringBond === "object").toBe(false);
        expect(typeof stringBond === "object" ? stringBond : null).toBeNull();
    });

    it("typeof guard should pass through resolved bond objects", () => {
        const objectBond = { name: "Brave", system: { ideals: [] } };
        expect(typeof objectBond === "object").toBe(true);
        expect(typeof objectBond === "object" ? objectBond : null).toBe(objectBond);
    });

    it("typeof guard should handle null correctly", () => {
        // typeof null === "object" is true in JS, so we need the && bond check
        const nullBond = null;
        expect(typeof nullBond === "object" && nullBond).toBeFalsy();
    });
});
