"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Unit } from "@/features/unit/types/unit.types";
import { Person } from "@/features/person/types/person.types";
import { Occupancy } from "@/features/occupancy/types/occupancy.types";
import { Property } from "@/features/property/types/property.types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    properties: Property[];
    units: Unit[];
    persons: Person[];
    occupancies: Occupancy[];
  }>({
    properties: [],
    units: [],
    persons: [],
    occupancies: [],
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [propRes, unitRes, personRes, occRes] = await Promise.all([
          fetch("/api/v1/properties"),
          fetch("/api/v1/units"),
          fetch("/api/v1/persons"),
          fetch("/api/v1/occupancies"),
        ]);

        const [propJson, unitJson, personJson, occJson] = await Promise.all([
          propRes.json(),
          unitRes.json(),
          personRes.json(),
          occRes.json(),
        ]);

        setData({
          properties: propJson.success ? propJson.data : [],
          units: unitJson.success ? unitJson.data : [],
          persons: personJson.success ? personJson.data : [],
          occupancies: occJson.success ? occJson.data : [],
        });
      } catch (err) {
        console.error("Failed to load search data:", err);
      } finally {
        setLoading(false);
      }
    };

    queueMicrotask(() => {
      loadData();
    });
  }, []);

  const term = query.toLowerCase().trim();

  const filteredProperties = term
    ? data.properties.filter(
        (p) =>
          p.name_en.toLowerCase().includes(term) ||
          p.name_th.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term)
      )
    : [];

  const filteredUnits = term
    ? data.units.filter(
        (u) =>
          u.unit_number.toLowerCase().includes(term) ||
          (u.building_code && u.building_code.toLowerCase().includes(term))
      )
    : [];

  const filteredPersons = term
    ? data.persons.filter(
        (p) =>
          p.first_name.toLowerCase().includes(term) ||
          p.last_name.toLowerCase().includes(term) ||
          (p.email && p.email.toLowerCase().includes(term)) ||
          (p.phone && p.phone.toLowerCase().includes(term)) ||
          (p.person_code && p.person_code.toLowerCase().includes(term))
      )
    : [];

  const filteredOccupancies = term
    ? data.occupancies.filter((o) => {
        const typeMatch = o.occupancy_type.toLowerCase().includes(term);
        const unitMatch = o.unit?.unit_number.toLowerCase().includes(term);
        const personMatch = o.person
          ? `${o.person.first_name} ${o.person.last_name || ""}`
              .toLowerCase()
              .includes(term)
          : false;

        return typeMatch || unitMatch || personMatch;
      })
    : [];

  const totalResults =
    filteredProperties.length +
    filteredUnits.length +
    filteredPersons.length +
    filteredOccupancies.length;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-xl font-bold">Global Search</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search across properties, units, persons, and active occupancies.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type search terms (e.g. Unit code, Person name, phone number, email)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 p-3 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm shadow-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none"
            autoFocus
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading datasets...</div>
        ) : term === "" ? (
          <div className="p-12 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center text-slate-400 text-sm">
            Enter a search term above to begin searching.
          </div>
        ) : totalResults === 0 ? (
          <div className="p-12 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center text-slate-400 text-sm">
            No matching results found for &quot;{query}&quot;.
          </div>
        ) : (
          <div className="space-y-8">
            <div className="text-sm text-slate-500">
              Found {totalResults} grouped result(s)
            </div>

            {/* Properties section */}
            {filteredProperties.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Properties ({filteredProperties.length})
                </h3>
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700 shadow-sm">
                  {filteredProperties.map((p) => (
                    <div key={p.id} className="p-4 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-semibold">{p.name_en} ({p.name_th})</div>
                        <div className="text-xs text-slate-400 mt-0.5">Code: {p.code}</div>
                      </div>
                      <Link
                        href={`/properties/${p.id}/edit`}
                        className="text-xs text-[#D4AF37] font-medium hover:underline"
                      >
                        Edit Property
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Units section */}
            {filteredUnits.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Units ({filteredUnits.length})
                </h3>
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700 shadow-sm">
                  {filteredUnits.map((u) => (
                    <div key={u.id} className="p-4 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-mono font-semibold">Unit {u.unit_number}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Building: {u.building_code || "Main"} | Floor: {u.floor}
                        </div>
                      </div>
                      <Link
                        href={`/units/${u.id}`}
                        className="text-xs text-[#D4AF37] font-medium hover:underline"
                      >
                        View Unit
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Persons section */}
            {filteredPersons.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  People ({filteredPersons.length})
                </h3>
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700 shadow-sm">
                  {filteredPersons.map((p) => (
                    <div key={p.id} className="p-4 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-semibold">
                          {p.title ? `${p.title} ` : ""}
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Email: {p.email || "-"} | Phone: {p.phone || "-"}
                        </div>
                      </div>
                      <Link
                        href={`/persons/${p.id}`}
                        className="text-xs text-[#D4AF37] font-medium hover:underline"
                      >
                        View Person Profile
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Occupancies section */}
            {filteredOccupancies.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Occupancy Records ({filteredOccupancies.length})
                </h3>
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700 shadow-sm">
                  {filteredOccupancies.map((o) => (
                    <div key={o.id} className="p-4 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-semibold">
                          {o.occupancy_type} in Unit {o.unit?.unit_number}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Occupant: {o.person ? `${o.person.first_name} ${o.person.last_name || ""}` : "-"}
                          {" | "}
                          Period: {o.start_date} to {o.end_date || "Present"}
                        </div>
                      </div>
                      <Link
                        href={`/occupancies/${o.id}`}
                        className="text-xs text-[#D4AF37] font-medium hover:underline"
                      >
                        View Assignment
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
