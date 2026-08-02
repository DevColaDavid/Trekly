import { useState } from 'react';
import { Image, Pressable, Text, StyleSheet, Linking } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';
import { staticMapUrl, mapsSearchUrl } from '../lib/staticMap';

type Props = {
  location: string;
  lat: number;
  lng: number;
};

const MAP_WIDTH = 600;
const MAP_HEIGHT = 240;

export default function MapPreview({ location, lat, lng }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable onPress={() => setVisible((v) => !v)}>
        <Text style={styles.toggle}>{visible ? 'Hide map' : 'Show map'}</Text>
      </Pressable>
      {visible && (
        <Pressable onPress={() => Linking.openURL(mapsSearchUrl(location, lat, lng))}>
          <Image source={{ uri: staticMapUrl(lat, lng, MAP_WIDTH, MAP_HEIGHT) }} style={styles.map} resizeMode="contain" />
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toggle: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: spacing.xs },
  // full width, height follows the source aspect ratio instead of cropping to a
  // fixed height — grows taller on wide screens rather than stretching/blurring.
  map: { width: '100%', aspectRatio: MAP_WIDTH / MAP_HEIGHT, borderRadius: radius.md, backgroundColor: '#E5E7EB', marginTop: spacing.xs },
});
