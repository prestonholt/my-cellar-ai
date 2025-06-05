'use client';

import { motion } from 'framer-motion';
import { WineBottleIcon } from './icons';

export const Greeting = () => {
  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
          <WineBottleIcon size={24} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-semibold"
        >
          Welcome to My Cellar AI!
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
        className="text-xl text-zinc-500"
      >
        Ask me about wine pairings, recommendations, or anything about your
        collection!
      </motion.div>
    </div>
  );
};
