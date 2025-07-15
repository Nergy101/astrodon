---
title: Mapperly
date: 2024-12-21
author: Christian / Nergy101
tags: [C#, dotnet]
---

# Mapperly: Better mappers

At some point in your career, you will be manually mapping model A to model B, model C to model D, etc., until you get really, and I mean really, fed up with it. Then, you want to try and make it easier, faster, and better for the next models you will have to map.

Most people will know about **AutoMapper**, the de facto library for creating dotnet mappers. However, there's a new kid on the block with some sweet promises. AutoMapper along with others and manual mappings can get messy. It can be hard to pinpoint what properties you forgot to map, or which mappings you're missing.

The new kid is called [Mapperly](https://github.com/riok/mapperly), and it is a library for creating mappers with the help of **source generation** which makes it:

- faster (uses zero reflection)
- provide a better developer experience (DX)
- not hard to learn, as it's mainly just attributes

## Table of Contents

- [Introduction](#introduction)
- [Simple Mapping Example](#simple-mapping-example)
- [Advanced Mapping with Nested Models](#advanced-mapping-with-nested-models)
- [Property Mapping and Value Generation](#property-mapping-and-value-generation)
- [Conclusion](#conclusion)

---

Let's have a look at how to use **Mapperly**, first let me sketch an example of two simple models that we want to map, with only some minor differences for now:

Model A:

```csharp
public class Dragon
{
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public Element Element { get; set; }
    public string[] Powers { get; set; } = Array.Empty<string>();
}

public enum Element
{
    Fire,
    Ice,
    Lightning,
    Earth
}
```

Model B:

```csharp
public class DragonModel
{
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Element { get; set; } = string.Empty;
    public string[] Powers { get; set; } = Array.Empty<string>();
}
```

Our mapper to map between both models would look like:

```csharp
[Mapper]
public partial class DragonMapper
{
    public partial DragonModel Map(Dragon dragon);
    public partial Dragon Map(DragonModel dragonModel);
}
```

Here the methods are both named Map, but you could be more explicit if you want to be. Isn't this nice and concise? But of course, this is a very straightforward example. Take note of the* partial* keywords which is because the actual mapping code is being generated for us by Mapperly. This is perfectly readable code by the way, here is a snippet of what Mapperly generates (not the full file):

```csharp
public partial class DragonMapper
{
    public DragonModel Map(Dragon dragon)
    {
        return new DragonModel
        {
            Name = dragon.Name,
            Age = dragon.Age,
            Element = dragon.Element.ToString(),
            Powers = dragon.Powers
        };
    }
}
```

As you can see, it generated an enum-to-string for the Element and array-to-array method, all perfectly viewable and readable code.

But this is just the beginning.

Next up let's try a more complicated mapping, showcasing how to map nested models, ignoring "leftover" properties and generating a value for an otherwise empty mapped property:

Model C includes a new ID field and Origin-type property:

```csharp
public class Dragon
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public Element Element { get; set; }
    public string[] Powers { get; set; } = Array.Empty<string>();
    public Origin Origin { get; set; } = new();
}

public class Origin
{
    public string Realm { get; set; } = string.Empty;
    public string Dimension { get; set; } = string.Empty;
}
```

Model D ignores the Id field and doesn't use the nested Origin property:

```csharp
public class DragonModel
{
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Element { get; set; } = string.Empty;
    public string[] Powers { get; set; } = Array.Empty<string>();
    public string Realm { get; set; } = string.Empty;
    public string Dimension { get; set; } = string.Empty;
}
```

As soon as I added the "Id" property on the Dragon, the mapper code gave this warning in my IDE:

> RMG020: The member Id on the mapping source type DragonMapperly.Dragon is not mapped to any member on the mapping target type DragonMapperly.DragonModel

And the same kind of thing happened for every other mis(sed)-configuration. For this example let's generate a new Guid when mapping from the DragonModel to a Dragon, but ignore (leave out) the Id field when mapping from Dragon to DragonModel. Also, we are flat-mapping the Dragon.Origin to the DragonModel. This is actually* the default*, but the attribute makes it more clear for this example. We are also unflatting from DragonModel to Dragon.Origin. This is **not the default**, so we need those two MapProperty attributes.

Adjusting for these changes, our mapper now looks like this:

```csharp
[Mapper]
public partial class DragonMapper
{
    [MapProperty(nameof(Dragon.Origin.Realm), nameof(DragonModel.Realm))]
    [MapProperty(nameof(Dragon.Origin.Dimension), nameof(DragonModel.Dimension))]
    public partial DragonModel Map(Dragon dragon);

    [MapProperty(nameof(DragonModel.Realm), nameof(Dragon.Origin.Realm))]
    [MapProperty(nameof(DragonModel.Dimension), nameof(Dragon.Origin.Dimension))]
    public partial Dragon Map(DragonModel dragonModel);

    private Guid UseNewGuid() => Guid.NewGuid();
}
```

Easy enough, right? With the Use-notation, we can use any method in the same class. This comes in very handy for generating values, using other Mapperly-mapping methods to map other models, etc.

Like I said, in his process, Mapperly is telling us exactly what properties we are forgetting to map. This has saved me a few times already from needing to debug huge mappers to see what was missing from my configurations in other libraries or manual mappings.

Anyways, I hope you have learned something today, and got curious enough about Mapperly to use it in your next app or project!
