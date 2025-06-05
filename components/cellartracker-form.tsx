'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Loader2 } from 'lucide-react';

interface CellarTrackerFormProps {
  onSubmit: (credentials: { username: string; password: string }) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function CellarTrackerForm({ onSubmit, isLoading, error }: CellarTrackerFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      await onSubmit({ username, password });
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">CellarTracker Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">CellarTracker Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              className={error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}
            />
            {error && (
              <p className="text-sm text-red-600 mt-1">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading your cellar...
              </>
            ) : (
              'Connect to CellarTracker'
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Your credentials are securely stored and used only to fetch your wine collection.
        </p>
      </CardContent>
    </Card>
  );
}