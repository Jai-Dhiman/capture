<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";
	export const badgeVariants = tv({
		base: "focus:ring-stone-400 inline-flex select-none items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
		variants: {
			variant: {
				default:
					"bg-stone-900 text-white hover:bg-stone-800 border-transparent shadow",
				secondary:
					"bg-stone-100 text-stone-900 hover:bg-stone-200 border-transparent",
				destructive:
					"bg-red-500 text-white hover:bg-red-600 border-transparent shadow",
				outline: "text-stone-900 border-stone-300",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import type { WithElementRef } from "bits-ui";
	import type { HTMLAnchorAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? "a" : "span"}
	bind:this={ref}
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
