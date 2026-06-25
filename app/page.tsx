
import React from "react";
import MainLayout from "../components/layout/MainLayout";
          
function KpiCard({ title, value, delta }: { title: string; value: string; delta?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-4 shadow-sm">
      <dt className="text-sm font-medium text-slate-500 dark:text-slate-300">{title}</dt>
      <dd className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</span>
        {delta && <span className="text-sm text-green-600 dark:text-green-400">{delta}</span>}
      </dd>
    </div>
  );
}

export default function Page() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <section aria-labelledby="overview-heading">
          <div className="flex items-center justify-between">
            <h2 id="overview-heading" className="text-xl font-semibold">Overview</h2>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Active Residents" value="1,284" delta="+3.2%" />
            <KpiCard title="Open Work Orders" value="24" delta="-1.7%" />
            <KpiCard title="Vacancies" value="8" delta="+0.4%" />
            <KpiCard title="Monthly Revenue" value="$124,800" delta="+5.6%" />
          </div>
        </section>

        <section aria-labelledby="activity-heading">
          <div className="flex items-center justify-between">
            <h3 id="activity-heading" className="text-lg font-medium">Recent Activity</h3>
            <a href="#" className="text-sm text-indigo-600">View all</a>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-4">
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {[
                  "New tenant application submitted",
                  "Work order #412 assigned",
                  "Visitor check-in at Main Lobby",
                  "Monthly rent batch processed",
                ].map((text) => (
                  <li key={text} className="py-3">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{text}</p>
                    <p className="text-xs text-slate-400">Just now</p>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-medium">Shortcuts</h4>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a className="text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded-md text-center" href="#">New Work Order</a>
                <a className="text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded-md text-center" href="#">Register Visitor</a>
                <a className="text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded-md text-center" href="#">New Reservation</a>
                <a className="text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded-md text-center" href="#">Create Report</a>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
