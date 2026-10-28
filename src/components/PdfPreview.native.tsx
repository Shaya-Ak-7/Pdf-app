import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Pdf from 'react-native-pdf';

import type { AppFile } from '../types';
import type { AppTheme } from '../theme';

type Props = {
  file: AppFile;
  theme: AppTheme;
};

/**
 * Full-bleed, Drive-style PDF viewer surface:
 * - content fills the screen (no card/frame)
 * - continuous vertical scroll with pinch zoom
 * - bottom bar: previous/next, current page indicator, jump-to-page
 */
export function PdfPreview({ file, theme }: Props) {
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [jumpText, setJumpText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const goTo = (target: number) => {
    if (!pageCount) return;
    const clamped = Math.min(Math.max(1, target), pageCount);
    setPage(clamped);
  };

  const submitJump = () => {
    const parsed = Number.parseInt(jumpText, 10);
    if (Number.isFinite(parsed)) goTo(parsed);
    setJumpText('');
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}> 
      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Could not render this PDF here.</Text>
          <Text style={[styles.errorText, { color: theme.colors.muted }]}>{error}</Text>
          <Text style={[styles.errorText, { color: theme.colors.muted }]}>Use Open external or Share for this file.</Text>
        </View>
      ) : (
        <Pdf
          source={{ uri: file.uri, cache: true }}
          style={styles.pdf}
          trustAllCerts={false}
          enablePaging={false}
          spacing={8}
          minScale={0.5}
          maxScale={4}
          page={page}
          onLoadComplete={(numberOfPages) => setPageCount(numberOfPages)}
          onPageChanged={(currentPage) => setPage(currentPage)}
          onError={(err) => setError(err?.message ?? 'Unknown PDF error')}
        />
      )}

      <View style={[styles.pageBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}> 
        <Pressable
          disabled={page <= 1}
          onPress={() => goTo(page - 1)}
          style={({ pressed }) => [styles.navButton, { backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent' }]}
        >
          <Text style={[styles.navText, { color: page <= 1 ? theme.colors.faint : theme.colors.text }]}>‹</Text>
        </Pressable>

        <View style={[styles.pageChip, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}> 
          <TextInput
            value={jumpText}
            onChangeText={setJumpText}
            onSubmitEditing={submitJump}
            placeholder={String(page)}
            placeholderTextColor={theme.colors.faint}
            keyboardType="number-pad"
            returnKeyType="go"
            style={[styles.jumpInput, { color: theme.colors.text }]}
          />
          <Text style={[styles.pageChipText, { color: theme.colors.muted }]}>/ {pageCount || '—'}</Text>
        </View>

        <Pressable
          disabled={!pageCount || page >= pageCount}
          onPress={() => goTo(page + 1)}
          style={({ pressed }) => [styles.navButton, { backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent' }]}
        >
          <Text style={[styles.navText, { color: !pageCount || page >= pageCount ? theme.colors.faint : theme.colors.text }]}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 320,
  },
  pdf: {
    flex: 1,
  },
  pageBar: {
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 16,
  },
  navButton: {
    width: 44,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: -2,
  },
  pageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 92,
    justifyContent: 'center',
  },
  jumpInput: {
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
    minWidth: 28,
    textAlign: 'center',
  },
  pageChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
