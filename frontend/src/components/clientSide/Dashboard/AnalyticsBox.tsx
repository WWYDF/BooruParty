'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
} from 'recharts';

const COLORS = {
  SAFE: '#22c55e',
  SKETCHY: '#facc15',
  UNSAFE: '#ef4444',
};

export default function AnalyticsOverview() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard/analytics')
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return <p className="text-subtle">Loading...</p>;

  const safetyData = [
    { name: 'Safe', value: data.safePosts, color: COLORS.SAFE },
    { name: 'Sketchy', value: data.sketchyPosts, color: COLORS.SKETCHY },
    { name: 'Unsafe', value: data.unsafePosts, color: COLORS.UNSAFE },
  ];

  const summaryStats = [
    { label: 'Total Posts', value: data.totalPosts },
    { label: 'Posts with Notes', value: data.postsWithNotes },
    { label: 'New Posts (Today)', value: data.postsToday },
    { label: 'Posts Deleted (Today)', value: data.postsDeletedToday },

    { label: 'Active Users (Today)', value: data.usersActiveToday },
    { label: 'Total Users', value: data.totalUsers },
    { label: 'New Users (7d)', value: data.usersThisWeek },

    { label: 'Total Comments', value: data.totalComments },
    { label: 'Total Post Votes', value: data.totalVotes },
    { label: 'Total Favorites', value: data.totalFavorites },

    { label: 'Pools', value: data.poolCount },
    { label: 'Posts in Pools', value: data.postsInPools },

    // { label: 'Admins', value: data.admins },
    { label: 'Audits (24h)', value: data.auditToday },
    
  ];

  function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 text-white text-sm px-3 py-2 rounded-lg shadow border border-zinc-700">
          <p className="capitalize">{payload[0].name || label}:</p>
          <p className="font-bold">{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
  
    return null;
  }

  return (
    <div className="bg-secondary border border-secondary-border p-6 rounded-2xl shadow w-full">
      <h2 className="text-xl font-semibold mb-4">Site Analytics</h2>

      {/* Safety Pie Chart */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/2 flex justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={safetyData}
                dataKey="value"
                nameKey="name"
                label
                stroke='border-secondary-border'
              >
                {safetyData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} cursor={false} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Highlight Counter */}
        <div className="flex flex-col justify-center gap-3 w-full md:w-1/2">
          {summaryStats.slice(0, 4).map((stat, i) => (
            <AnimatedStat key={i} label={stat.label} value={stat.value} />
          ))}
        </div>
      </div>

      {/* Bar Chart: Uploads and Comments */}
      <div className="mt-6">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={[
              { label: 'Uploads', value: data.uploadsThisWeek },
              { label: 'Users (7d)', value: data.usersThisWeek },
              { label: 'Votes', value: data.totalVotes },
              { label: 'Comments', value: data.totalComments },
            ]}
            
          >
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="value" fill="#38bdf8" isAnimationActive={false} activeBar={false}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grid of Other Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        {summaryStats.slice(4).map((stat, i) => (
          <AnimatedStat key={i} label={stat.label} value={stat.value} />
        ))}
      </div>
    </div>
  );
}

function AnimatedStat({ label, value }: { label: string; value: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.random() * 0.3, duration: 0.4 }}
      className="border border-secondary-border p-4 rounded-xl flex flex-col"
    >
      <span className="text-sm text-subtle">{label}</span>
      <span className="text-2xl font-bold">{value.toLocaleString()}</span>
    </motion.div>
  );
}
