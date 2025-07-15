---
title: Fluent Results
date: 2025-01-09
author: Christian / Nergy101
tags: [C#, dotnet, FluentResults]
---

# Fluent Results: A Better Approach to Error Handling

As a programmer, you've surely thrown an exception/error or two. For this blog, I will call them exceptions. Throwing exceptions is perfectly normal, and it is often encouraged to "Fail fast!". For the longest time, I agreed. While writing APIs I would throw exceptions, catch them through some middleware, and return with proper response codes or details. However, sometimes I would miss some information, not "know" the details of that specific exception anymore, or the location where the exception occurred would be hard to trace back.

## Table of Contents

- [Fluent Results: A Better Approach to Error Handling](#fluent-results-a-better-approach-to-error-handling)
  - [Table of Contents](#table-of-contents)
  - [The Rust Inspiration](#the-rust-inspiration)
  - [RFC 7807 - Problem Details for HTTP APIs](#rfc-7807---problem-details-for-http-apis)
  - [Enter FluentResults](#enter-fluentresults)
  - [Exception Mapping](#exception-mapping)
  - [Conclusion](#conclusion)

---

## The Rust Inspiration

However, while I was fiddling with Rust, I was intrigued by their Result-based approach. The Result-based approach preaches that...

> **Everything** is a Result

"So that means if I encounter an exceptional case in my code... I don't throw?"

Yep, that's exactly what it means. Instead, we will return some kind of problem detail describing the exceptional case, or anything else we want to send back. At my own work, we prefer to return a "ProblemDetail":

## RFC 7807 - Problem Details for HTTP APIs

An example of this RFC in JSON:

```json
{
  "type": "https://example.com/probs/out-of-credit",
  "title": "You do not have enough credit.",
  "detail": "Your current balance is 30, but that costs 50.",
  "instance": "/account/12345/msgs/abc",
  "balance": 30,
  "accounts": ["/account/12345", "/account/67890"]
}
```

As you can see, if I were to return details like this, it would be a lot more descriptive than just seeing that I had a "NotEnoughCreditException" at some point. For development purposes only, we usually also include the full exception and stack trace. For security purposes, though, we don't do this on acceptance or production.

## Enter FluentResults

For anything C#, I'm a big fan of the "Fluent..." packages like FluentValidations, FluentAssertions, etc. So when I saw there's also a FluentResults package, I got very stoked.

Let's see what it looks like!

In its basis, a Result is an object indicating Success (Ok) or Failure (Fail):

```csharp
// Success case
Result result = Result.Ok();

// Failure case
Result result = Result.Fail("Something went wrong");
```

Of course, we can return these results "manually" from our methods, but we can also "map" certain kinds of exceptions to certain result errors, using the Setup and Try methods. Let's try our critical method (pun intended):

```csharp
// Manual approach
public Result DoSomethingCritical()
{
    try
    {
        // Critical operation
        return Result.Ok();
    }
    catch (Exception ex)
    {
        return Result.Fail(ex.Message);
    }
}

// Using FluentResults Try method
public Result DoSomethingCritical()
{
    return Result.Try(() => {
        // Critical operation
    });
}
```

> **Note:** All of FluentResults works sync and async

## Exception Mapping

Let's say, the critical exception is of type `DomainException`. If we have configured FluentResults with the Setup as seen below:

```csharp
Result.Setup(options =>
{
    options.ErrorFactory = exception =>
    {
        if (exception is DomainException domainEx)
        {
            return new DomainExceptionError(domainEx.Message);
        }
        return new Error(exception.Message);
    };
});
```

We can make FluentResults return an Error in its result instead:

```csharp
// Error is from the FluentResults package
public class DomainExceptionError : Error
{
    public DomainExceptionError(string message) : base(message)
    {
    }
}
```

This `DomainExceptionError` will now be in the `result.Errors` array. Using these same mechanics, we could create a descriptive ProblemDetail that inherits from the Error class, and presto.

## Conclusion

I'm not quite done with this Blog, but it's good enough to publish.

**Stay tuned!**
