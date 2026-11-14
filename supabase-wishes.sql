-- Run this entire file in the Supabase SQL Editor.
-- Safe to run again: names are updated, existing reservations are kept.
-- When adding a gift, use the same ID here and in its HTML data-wish-id.

insert into public.wishes (id, name)
values
    ('go60', 'MoErgo Go60'),
    ('sihoo-s100', 'Sihoo S100'),
    ('laptop-stand', 'Laptopstativ'),
    ('fishing-thermometer', 'Termometer (fiske)'),
    ('magnetic-net-holder', 'Håvholder'),
    ('book-name-of-the-wind', 'The Name of the Wind'),
    ('monitor-arm-ldt115', 'Heavy-Duty (LDT115)'),
    ('monitor-arm-slim-v2', 'SLIM V2'),
    ('monitor-arm-hercules', 'MaxMount Hercules'),
    ('desk-walnut-top', 'Valnøtt bordplate (200 × 80 cm)'),
    ('desk-iiglo-frame', 'Iiglo understell'),
    ('danica-cam-vise', 'Danica Cam Vise'),
    ('loon-tool-kit', 'Loon Core Tool Kit'),
    ('eco-warrior-dubbing', 'Eco Warrior Dubbing'),
    ('futurefly-cdc', 'FutureFly CDC'),
    ('pheasant-tail-feathers', 'Fasanhalefjær'),
    ('peacock-herl', 'Fulling Mill påfuglherl'),
    ('comparadun-deer-hair', 'Comparadun hjortehår'),
    ('veevus-black-thread', 'Veevus 12/0 – svart'),
    ('uni-olive-thread', 'UNI 6/0 – oliven'),
    ('tmc100-hooks-12', 'Tiemco TMC 100 – størrelse 12'),
    ('tmc100-hooks-14', 'Tiemco TMC 100 – størrelse 14'),
    ('tmc100-hooks-16', 'Tiemco TMC 100 – størrelse 16'),
    ('tippet-0128', 'Fortom 0,128 mm'),
    ('tippet-0148', 'Fortom 0,148 mm'),
    ('tippet-0185', 'Fortom 0,185 mm')
on conflict (id) do update
set name = excluded.name;
