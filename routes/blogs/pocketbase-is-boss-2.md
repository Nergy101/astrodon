---
title: PocketBase is Boss
date: 2024-12-10
author: Christian / Nergy101
tags: [Pocketbase]
---

# PocketBase: The Single-File Backend That's Actually Boss

I'm sure you've all heard of Backend as a Service or BaaS.

Just to name a few:

- Firebase
- Supabase
- AWS Amplify
- The list goes on and on and on

Today we will dive a bit into PocketBase and why I have been using it to build [Tovedem](https://tovedem.nergy.space), rather rapidly and carefree.

## Table of Contents

- [PocketBase: The Single-File Backend That's Actually Boss](#pocketbase-the-single-file-backend-thats-actually-boss)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Getting Started](#getting-started)
  - [Basic JavaScript SDK Usage](#basic-javascript-sdk-usage)
  - [Conclusion](#conclusion)

---

## Introduction

First off, what **is** PocketBase?

[PocketBase](https://pocketbase.io) is a backend service in a single file. It's being built as a framework in Go with a SQLite database backing. As said it is available to use as a framework, but not only that. It's also available as a database + backend application that encompasses most of the basic development work. Think of authentication (O-Auth), managing SQL tables with different relationships, APIs on this data, and real-time feeds.

Another thing;

The documentation is GREAT! While extending PocketBase functionality with Javascript, the documentation is up-to-date and very searchable. One example is the recent update to version 0.23. This had quite a few breaking changes, which were well-documented and easy to follow.

## Getting Started

Let's have a quick look at how to get started with PocketBase.

Self-host in your preferred way, either with Docker or simply by running the executable. Then visit `localhost:8090/_/` to be visited by the dashboard. Within this dashboard, we can manage the authentication providers, database schema, the data inside, logging, and different kinds of settings.

Managing your data schema is really easy & visual,
Just add the fields you want for a collection, and you're done! Notice how there are some quite complex types you can add easily like rich text editor texts, emails, and whole files. Also, take special mention of the 'relation' type which allows for configuring 1-n or n-1 or 1-1 relationships between different collections.

## Basic JavaScript SDK Usage

Once you have your PocketBase instance running, you can easily interact with it using the JavaScript SDK. Here's a quick example:

```javascript
import PocketBase from 'pocketbase';

// Initialize the client
const pb = new PocketBase('http://127.0.0.1:8090');

// Authenticate a user
const authData = await pb
  .collection('users')
  .authWithPassword('test@example.com', '1234567890');

// Create a new record
const data = {
  title: 'My First Post',
  content: 'Hello PocketBase!',
  author: pb.authStore.model.id,
};
const record = await pb.collection('posts').create(data);

// Fetch records with filtering
const records = await pb.collection('posts').getList(1, 20, {
  filter: 'created >= "2024-01-01"',
  sort: '-created',
});

// Real-time subscription
pb.collection('posts').subscribe('*', function (e) {
  console.log('Real-time update:', e.record);
});
```

The SDK makes it incredibly simple to handle authentication, CRUD operations, and real-time updates with just a few lines of code.

## Conclusion

If you want more on PocketBase, be sure to sign up, follow or even contact me. It's my plan to update this blog into a full tutorial and getting-started. Hope to see you around!

Cheers, and, by the way, "BaaS" translates to "boss" in Dutch.
