---
title: 'PocketBase is Boss'
date: 2024-12-10
author: Christian / Nergy101
tags: [pocketbase]
---

I'm sure you've all heard of Backend as a Service or BaaS.

Just to name a few:

- Firebase
- Supabase
- AWS Amplify
- The list goes on and on and on

Today we will dive a bit into PocketBase and why I have been using it to build [Tovedem](https://tovedem.nergy.space), rather rapidly and carefree.

First off, what **is** PocketBase?

[PocketBase](https://pocketbase.io) is a backend service in a single file. It's being built as a framework in Go with a SQLite database backing. As said it is available to use as a framework, but not only that. It's also available as a database + backend application that encompasses most of the basic development work. Think of authentication (O-Auth), managing SQL tables with different relationships, APIs on this data, and real-time feeds.

Another thing;

The documentation is GREAT! While extending PocketBase functionality with Javascript, the documentation is up-to-date and very searchable. One example is the recent update to version 0.23. This had quite a few breaking changes, which were well-documented and easy to follow.

Let's have a quick look at how to get started with PocketBase.

Self-host in your preferred way, either with Docker or simply by running the executable. Then visit `localhost:8090/_/` to be visited by the dashboard. Within this dashboard, we can manage the authentication providers, database schema, the data inside, logging, and different kinds of settings.

Managing your data schema is really easy & visual:

```
[FIGURE PLACEHOLDER]
```

Just add the fields you want for this collection, and you're done! Notice how there are some quite complex types you can add easily like rich text editor texts, emails, and whole files. Also, take special mention of the 'relation' type which allows for configuring 1-n or n-1 or 1-1 relationships between different collections.

If you want more on PocketBase, be sure to sign up, follow or even contact me. It's my plan to update this blog into a full tutorial and getting-started. Hope to see you around!

Cheers, and, by the way, "BaaS" translates to "boss" in Dutch.
