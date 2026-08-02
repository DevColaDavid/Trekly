-- Feature: map preview for event location.
alter table public.events add column if not exists location_lat double precision;
alter table public.events add column if not exists location_lng double precision;
