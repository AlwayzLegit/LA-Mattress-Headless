'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/app/_components/icon';

export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?${new URLSearchParams({ q }).toString()}` : '/search');
  };

  return (
    <form className="search-form" onSubmit={onSubmit} role="search">
      <label className="search-input">
        <Icon name="search" size={18} />
        <input
          type="search"
          name="q"
          autoFocus
          autoComplete="off"
          placeholder="Search mattresses, brands, sizes&hellip;"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          aria-label="Search products"
        />
        <button type="submit" className="btn btn-primary">Search</button>
      </label>
    </form>
  );
}
