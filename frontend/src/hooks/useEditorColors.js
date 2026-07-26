import { useState, useRef, useCallback } from 'react';
import { colorsApi } from '../api/colors';

const PAGE_LIMIT = 50;

export default function useEditorColors() {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const requestIdRef = useRef(0);
  const pageRef = useRef(1);
  const searchRef = useRef('');
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const loadFirstPage = useCallback(async (searchTerm = '') => {
    const requestId = ++requestIdRef.current;
    searchRef.current = searchTerm;
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadingMoreRef.current = false;

    setLoading(true);
    setError(null);
    setColors([]);
    setHasMore(true);

    try {
      const params = { page: 1, limit: PAGE_LIMIT, is_active: 'true' };
      if (searchTerm) params.search = searchTerm;
      const result = await colorsApi.list(params);
      if (requestId !== requestIdRef.current) return;

      const rows = Array.isArray(result) ? result : (result?.data ?? []);
      const pagination = result?.pagination;

      setColors(rows);
      const more = pagination?.hasNextPage ?? rows.length >= PAGE_LIMIT;
      setHasMore(more);
      hasMoreRef.current = more;
      pageRef.current = 2;
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err);
        setColors([]);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);

    const requestId = requestIdRef.current;
    const currentPage = pageRef.current;

    try {
      const params = { page: currentPage, limit: PAGE_LIMIT, is_active: 'true' };
      if (searchRef.current) params.search = searchRef.current;
      const result = await colorsApi.list(params);
      if (requestId !== requestIdRef.current) return;

      const rows = Array.isArray(result) ? result : (result?.data ?? []);
      const pagination = result?.pagination;

      setColors((prev) => [...prev, ...rows]);
      const more = pagination?.hasNextPage ?? rows.length >= PAGE_LIMIT;
      setHasMore(more);
      hasMoreRef.current = more;
      pageRef.current = currentPage + 1;
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, []);

  const retry = useCallback(() => {
    if (colors.length === 0) {
      loadFirstPage(searchRef.current);
    } else {
      loadMore();
    }
  }, [colors.length, loadFirstPage, loadMore]);

  return {
    colors,
    loading,
    loadingMore,
    error,
    hasMore,
    loadFirstPage,
    loadMore,
    retry,
  };
}
