---
title: Mapperly vs AutoMapper
date: 2025-09-01
author: Christian / Nergy101
tags: [C#, .NET, mapping, source-generators, BenchmarkDotNet]
---

### Mapperly: Better mappers and an alternative to AutoMapper

At some point you will map model A to B, C to D, and so on, until you’re thoroughly tired of it. Most .NET developers reach for **AutoMapper**—a mature, feature-rich library. There’s also **Mapperly**: a free, open-source alternative that uses Roslyn source generators to emit plain C# mapping code at compile time.

What that buys you:

- **Performance**: zero reflection in hot paths; simple IL the JIT can optimize well
- **Safety**: compile-time diagnostics for missing/ambiguous mappings (e.g., RMG020)
- **DX**: you can read the generated code when you need insight or a debugger step-through

AutoMapper remains excellent, with a huge ecosystem and powerful features. As of v15, AutoMapper requires [a paid commercial license for larger companies](https://automapper.io/#pricing); see the pricing page for details. Mapperly remains free and open source.

<img src="/assets/gifs/Show Me The Money GIF.gif" alt="gif">

And actually, I fully support Jimmy Bogard for his decision.
However it's also a great opportunity for other libraries to take the stage for anyone that doesn't want to spend money.

---

## Models used in this post

For the examples and benchmarks in this repo, we map a domain `Dragon` to a `DragonDto` with nested objects and a collection:

```csharp
public sealed class Dragon
{
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int AgeYears { get; set; }
    public double SizeMeters { get; set; }
    public Rider? Rider { get; set; }
    public Lair? Lair { get; set; }
    public List<Treasure> Hoard { get; set; } = new();
}
```

```csharp
public sealed class DragonDto
{
    public string DisplayName { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = string.Empty;
    public string Age { get; set; } = string.Empty;
    public int LengthCentimeters { get; set; }
    public bool IsAncient { get; set; }
    public RiderDto? Pilot { get; set; }
    public LairDto? Hideout { get; set; }
    public List<TreasureDto> HoardItems { get; set; } = new();
}
```

---

## Code comparison: AutoMapper vs Mapperly

### AutoMapper configuration

```csharp
public sealed class DragonsProfile : Profile
{
    public DragonsProfile()
    {
        CreateMap<Treasure, TreasureDto>()
            .ForMember(d => d.ItemName, o => o.MapFrom(s => s.Name))
            .ForMember(d => d.Category, o => o.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.ValueUsd, o => o.MapFrom(s => (double)s.EstimatedValue))
            .ForMember(d => d.WeightGrams, o => o.MapFrom(s => (int)System.Math.Round(s.WeightKg * 1000)));

        CreateMap<Lair, LairDto>()
            .ForMember(d => d.LairName, o => o.MapFrom(s => s.Name))
            .ForMember(d => d.Region, o => o.MapFrom(s => s.Location))
            .ForMember(d => d.Capacity, o => o.MapFrom(s => (long)s.Capacity))
            .ForMember(d => d.Hidden, o => o.MapFrom(s => s.IsHidden));

        CreateMap<Rider, RiderDto>()
            .ForMember(d => d.FullName, o => o.MapFrom(s => s.FirstName + " " + s.LastName))
            .ForMember(d => d.Experience, o => o.MapFrom(s => s.ExperienceLevel <= 3 ? "Novice" : (s.ExperienceLevel <= 6 ? "Skilled" : "Expert")))
            .ForMember(d => d.City, o => o.MapFrom(s => s.HomeTown));

        CreateMap<Dragon, DragonDto>()
            .ForMember(d => d.DisplayName, o => o.MapFrom(s => s.Name))
            .ForMember(d => d.PrimaryColor, o => o.MapFrom(s => s.Color))
            .ForMember(d => d.Age, o => o.MapFrom(s => s.AgeYears.ToString()))
            .ForMember(d => d.IsAncient, o => o.MapFrom(s => s.AgeYears >= 1000))
            .ForMember(d => d.LengthCentimeters, o => o.MapFrom(s => (int)System.Math.Round(s.SizeMeters * 100)))
            .ForMember(d => d.Pilot, o => o.MapFrom(s => s.Rider))
            .ForMember(d => d.Hideout, o => o.MapFrom(s => s.Lair))
            .ForMember(d => d.HoardItems, o => o.MapFrom(s => s.Hoard));
    }
}
```

### Mapperly mapper with source generation

```csharp
[Mapper]
public partial class DragonsMapper
{
    [MapProperty(nameof(Dragon.Name), nameof(DragonDto.DisplayName))]
    [MapProperty(nameof(Dragon.Color), nameof(DragonDto.PrimaryColor))]
    [MapProperty(nameof(Dragon.AgeYears), nameof(DragonDto.Age))]
    [MapProperty(nameof(Dragon.AgeYears), nameof(DragonDto.IsAncient))]
    [MapProperty(nameof(Dragon.SizeMeters), nameof(DragonDto.LengthCentimeters))]
    [MapProperty(nameof(Dragon.Rider), nameof(DragonDto.Pilot))]
    [MapProperty(nameof(Dragon.Lair), nameof(DragonDto.Hideout))]
    [MapProperty(nameof(Dragon.Hoard), nameof(DragonDto.HoardItems))]
    public partial DragonDto MapDragon(Dragon source);

    public partial List<DragonDto> MapDragons(List<Dragon> source);

    // Custom helpers re-used by the generated mapper
    [UserMapping]
    private static RiderDto MapRider(Rider source) => new()
    {
        FullName = string.Concat(source.FirstName, " ", source.LastName),
        Experience = MapExperience(source.ExperienceLevel),
        City = source.HomeTown
    };

    [UserMapping]
    private static LairDto MapLair(Lair source) => new()
    {
        LairName = source.Name,
        Region = source.Location,
        Capacity = source.Capacity,
        Hidden = source.IsHidden
    };

    [MapProperty(nameof(Treasure.Name), nameof(TreasureDto.ItemName))]
    [MapProperty(nameof(Treasure.Type), nameof(TreasureDto.Category))]
    [MapProperty(nameof(Treasure.EstimatedValue), nameof(TreasureDto.ValueUsd))]
    [MapProperty(nameof(Treasure.WeightKg), nameof(TreasureDto.WeightGrams))]
    public partial TreasureDto MapTreasure(Treasure source);

    [UserMapping]
    private static string MapExperience(int level) => level switch
    {
        <= 3 => "Novice",
        <= 6 => "Skilled",
        _ => "Expert"
    };
}
```

With Mapperly you keep concise, intention-revealing declarations and let the generator produce the concrete mapping code. You can also open the generated C# to review exactly what runs.

<img src="/assets/gifs/James Franco GIF.gif" alt="gif">

---

## Benchmarks: throughput and allocations

I used BenchmarkDotNet to compare both approaches on a Mac M2, .NET 9, mapping single items and collections of 1k, 10k, 100k, and 1M dragons.

- **Single item**: AutoMapper was ~1.37–1.84× slower than Mapperly and allocated ~1.16× more. Average was about 1.45× slower.
- **Collections**: AutoMapper was ~1.10–1.37× slower and allocated ~1.18× more

| Method                |  Entities | Time Ratio | Alloc Ratio |
| --------------------- | --------: | ---------: | ----------: |
| Mapperly Collection   |     1.000 |       1.00 |        1.00 |
| AutoMapper Collection |     1.000 |       1.14 |        1.17 |
| Mapperly Collection   |    10.000 |       1.00 |        1.00 |
| AutoMapper Collection |    10.000 |       1.37 |        1.18 |
| Mapperly Collection   |   100.000 |       1.00 |        1.00 |
| AutoMapper Collection |   100.000 |       1.10 |        1.18 |
| Mapperly Collection   | 1.000.000 |       1.00 |        1.00 |
| AutoMapper Collection | 1.000.000 |       1.26 |        1.17 |
| Mapperly Single       |         1 |       1.00 |        1.00 |
| AutoMapper Single     |         1 |       1.45 |        1.16 |

---

## Advanced and nested mapping

The sample shows nested mapping for `Rider` and `Lair`, and a collection of `Treasure`. Mapperly lets you:

- **Flatten/unflatten** via `[MapProperty]` between different shapes
- **Compose** generated code with your own `[UserMapping]` helpers
- **Get diagnostics** when you forget a property (e.g., missing `MapProperty`), early at compile time

You could, for example, convert units (`SizeMeters` → `LengthCentimeters`), compute flags (`IsAncient`), and merge names (`FullName`) — all with small helpers that remain easy to test.

## Compile-time diagnostics

If we were to add a `CreatedAt` datetime field to the dragon like so:

```csharp
public sealed class Dragon
{
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int AgeYears { get; set; }
    public double SizeMeters { get; set; }
    public Rider? Rider { get; set; }
    public Lair? Lair { get; set; }
    public List<Treasure> Hoard { get; set; } = new();

    public DateTime CreatedAt { get; set; }
}
```

our compiler will tell us:

```log
The member CreatedAt on the mapping source type
Benchmarks.Models.DomainModels.Dragon
is not mapped to any member on the mapping
target type Benchmarks.Models.DtoModels.DragonDto
```

And that's great, because it allows us to **know for sure** we didn't miss any properties to map,
and we have _at least_ specified what to do with every property.

---

## When to choose which

- **Mapperly**: prefer for performance-sensitive or large-batch mappings; when you want readable generated code and compile-time feedback. Also the licence is more permissive and its fully free to use, even for large companies.
- **AutoMapper**: prefer when you need advanced projection features (EF/Linq etc.), a broad ecosystem, or you already have significant profiles configured.

As ever, benchmark with your own models and sizes.

---

## Resources

- Mapperly GitHub: `https://github.com/riok/mapperly`
- Mapperly documentation: `https://mapperly.riok.app/`
- AutoMapper website & pricing: `https://automapper.io/#pricing`
- BenchmarkDotNet: `https://benchmarkdotnet.org/`

## Conclusion

Mapperly’s source-generated approach delivers simple, fast mapping code and early diagnostics.

In short:

<img src="/assets/gifs/Joe Biden GIF by GIPHY News.gif" alt="gif">

So go give it a try, and I am sure you won't regret it!

---

Want to stay updated? Bookmark this page or follow me on [GitHub](https://github.com/Nergy101)
