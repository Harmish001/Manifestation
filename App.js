import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  FlatList, ScrollView, StyleSheet, Alert, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

const KEY = 'woop_goals_v1';
const POPUP_KEY = 'woop_popup_v1';
const SCHEDULE = 'com.harmish.woopgoals.SCHEDULE';
const native = extras => Linking.sendIntent(SCHEDULE, extras).catch(() => {});
const today = () => new Date().toISOString().slice(0, 10);

function streak(log) {
  let n = 0;
  const d = new Date();
  if (!log.includes(today())) d.setDate(d.getDate() - 1);
  while (log.includes(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const FIELDS = [
  ['wish', 'Wish', 'What do you want? Make it specific and doable.'],
  ['outcome', 'Outcome', 'Best result? Picture it for a minute, then write it.'],
  ['obstacle', 'Obstacle', 'What inside YOU is most likely to get in the way?'],
  ['plan', 'Plan', 'If [obstacle] happens, then I will [action].'],
];

export default function App() {
  const [goals, setGoals] = useState([]);
  const [adding, setAdding] = useState(false);
  const [popup, setPopup] = useState(0);
  const [form, setForm] = useState({ wish: '', outcome: '', obstacle: '', plan: '' });

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => v && setGoals(JSON.parse(v))).catch(() => {});
    AsyncStorage.getItem(POPUP_KEY).then(v => v && setPopup(Number(v))).catch(() => {});
  }, []);

  const save = next => {
    setGoals(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next))
      .then(() => native([{ key: 'refresh', value: true }]))
      .catch(() => {});
  };

  const setPopupEvery = m => {
    setPopup(m);
    AsyncStorage.setItem(POPUP_KEY, String(m)).catch(() => {});
    native([{ key: 'enable', value: m > 0 }, { key: 'minutes', value: m > 0 ? m : 60 }]);
  };

  const addGoal = () => {
    if (FIELDS.some(([k]) => !form[k].trim())) {
      Alert.alert('Incomplete', 'Fill all four parts. The obstacle and plan are the ones that matter.');
      return;
    }
    save([{ id: String(Date.now()), ...form, log: [] }, ...goals]);
    setForm({ wish: '', outcome: '', obstacle: '', plan: '' });
    setAdding(false);
  };

  const toggleToday = id =>
    save(goals.map(g => g.id !== id ? g : {
      ...g,
      log: g.log.includes(today()) ? g.log.filter(d => d !== today()) : [...g.log, today()],
    }));

  const remove = id =>
    Alert.alert('Delete goal?', '', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => save(goals.filter(g => g.id !== id)) },
    ]);

  if (adding) {
    return (
      <SafeAreaView style={s.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={s.h1}>New goal (WOOP)</Text>
          {FIELDS.map(([k, label, hint]) => (
            <View key={k} style={{ marginBottom: 16 }}>
              <Text style={s.label}>{label}</Text>
              <Text style={s.hint}>{hint}</Text>
              <TextInput style={s.input} multiline value={form[k]}
                onChangeText={t => setForm({ ...form, [k]: t })} />
            </View>
          ))}
          <TouchableOpacity style={s.btn} onPress={addGoal}><Text style={s.btnT}>Save goal</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setAdding(false)}><Text style={s.link}>Cancel</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <View style={{ padding: 20, flex: 1 }}>
        <Text style={s.h1}>My goals</Text>
        <FlatList
          data={goals}
          keyExtractor={g => g.id}
          ListEmptyComponent={<Text style={s.hint}>No goals yet. Add one with a real obstacle and plan.</Text>}
          ListFooterComponent={
            <View style={s.card}>
              <Text style={s.wish}>Home-screen reminders</Text>
              <Text style={s.hint}>Widget: long-press your home screen, tap Widgets, pick WOOP Goals. Tap the widget text to show another goal.</Text>
              <Text style={s.hint}>Pop-up: shows a random goal over other apps at random times (between the chosen time and double it). Android will ask you to allow "Display over other apps".</Text>
              <View style={s.row}>
                {[30, 60, 120].map(m => (
                  <TouchableOpacity key={m} style={[s.chip, popup === m && s.chipOn]} onPress={() => setPopupEvery(m)}>
                    <Text style={[s.chipT, popup === m && s.chipTOn]}>~{m} min</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.btn} onPress={() => native([{ key: 'test', value: true }])}>
                <Text style={s.btnT}>Show a test pop-up now</Text>
              </TouchableOpacity>
              {popup > 0 && (
                <TouchableOpacity onPress={() => setPopupEvery(0)}><Text style={s.link}>Turn pop-ups off</Text></TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item: g }) => {
            const done = g.log.includes(today());
            return (
              <View style={s.card}>
                <Text style={s.wish}>{g.wish}</Text>
                <Text style={s.hint}>Obstacle: {g.obstacle}</Text>
                <Text style={s.plan}>Plan: {g.plan}</Text>
                <Text style={s.hint}>Streak: {streak(g.log)} day(s) · Total: {g.log.length}</Text>
                <TouchableOpacity style={[s.btn, done && s.btnDone]} onPress={() => toggleToday(g.id)}>
                  <Text style={s.btnT}>{done ? 'Done today ✓ (tap to undo)' : 'I acted on my plan today'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(g.id)}><Text style={s.link}>Delete</Text></TouchableOpacity>
              </View>
            );
          }}
        />
        <TouchableOpacity style={s.btn} onPress={() => setAdding(true)}>
          <Text style={s.btnT}>+ New goal</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#faf7f2', paddingTop: 30 },
  h1: { fontSize: 26, fontWeight: '700', marginBottom: 14, color: '#222' },
  label: { fontSize: 16, fontWeight: '600', color: '#222' },
  hint: { fontSize: 13, color: '#666', marginVertical: 3 },
  input: { borderWidth: 1, borderColor: '#d8d2c8', borderRadius: 8, padding: 10, minHeight: 48, backgroundColor: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  wish: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  plan: { fontSize: 14, color: '#2d5a3d', marginVertical: 3 },
  btn: { backgroundColor: '#2d5a3d', padding: 13, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnDone: { backgroundColor: '#8a8a8a' },
  btnT: { color: '#fff', fontWeight: '600' },
  link: { textAlign: 'center', color: '#a33', marginTop: 10 },
  row: { flexDirection: 'row', marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: '#2d5a3d', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 },
  chipOn: { backgroundColor: '#2d5a3d' },
  chipT: { color: '#2d5a3d', fontWeight: '600' },
  chipTOn: { color: '#fff' },
});
