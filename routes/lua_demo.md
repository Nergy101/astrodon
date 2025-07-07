---
title: 'Lua Interpolation Demo'
date: 2025-07-07
author: Christian / Nergy101
tags: ['demo', 'lua', 'interpolation']
---

# Lua Interpolation System Demo

This page demonstrates the Lua interpolation system in action. All the content below is generated dynamically using Lua scripts.

## Random Content

**Today's Programming Quote:**

> {{lua:random_quote}}

## Current Time Examples

**ISO Format:** {{lua:current_time}}

**Friendly Format:** {{lua:current_time:friendly}}

**Local Format:** {{lua:current_time:local}}

**Date Only:** {{lua:current_time:date}}

**Time Only:** {{lua:current_time:time}}

**Unix Timestamp:** {{lua:current_time:unix}}

## Counter Examples

**Simple Counter:** {{lua:counter:Item,3}}

**Step Counter:** {{lua:counter:Step,5}}

**Custom Counter:** {{lua:counter:Task,4}}

## Dynamic List Generation

Here's a dynamic list of items:

{{lua:counter:Feature,6}}

## Real-time Status

- **Build Time:** {{lua:current_time:friendly}}
- **Current Date:** {{lua:current_time:date}}
- **Current Time:** {{lua:current_time:time}}
- **Unix Timestamp:** {{lua:current_time:unix}}

## How This Works

This page uses the `/{/{lua:script_name/}/}` syntax to embed Lua script results directly in the markdown. During the build process:

1. The system finds all `/{/{lua:.../}/}` patterns
2. Executes the corresponding Lua scripts
3. Replaces the patterns with the script output
4. Processes the result through the markdown pipeline

The content you see above is generated fresh each time the site is built!
