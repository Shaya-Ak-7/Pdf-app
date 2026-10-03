import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';

import type { AppFile } from '../types';
import type { AppTheme } from '../theme';

type Props = {
  file: AppFile;
  theme: AppTheme;
};

export function PdfPreview({ file, theme }: Props) {
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={[styles.shell, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <View style={[styles.toolbar, { borderBottomColor: theme.colors.border }]}> 
        <Text style={[styles.toolbarText, { color: theme.colors.text }]}>PDF preview</Text>
        <Text style={[styles.toolbarText, { color: theme.colors.muted }]}>Page {page}{pageCount ? ` / ${pageCount}` : ''}</Text>
      </View>
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
          spacing={6}
          minScale={0.75}
          maxScale={4}
          onLoadComplete={(numberOfPages) => setPageCount(numberOfPages)}
          onPageChanged={(currentPage) => setPage(currentPage)}
          onError={(err) => setError(err?.message ?? 'Unknown PDF error')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: 560,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
  },
  toolbar: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pdf: {
    flex: 1,
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
