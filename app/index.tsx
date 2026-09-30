import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Artwork } from '../src/components/Artwork';
import { MonthlyProgressCard } from '../src/components/MonthlyProgressCard';
import { Eyebrow, Pill, PrimaryButton, uiStyles } from '../src/components/ui';
import { getVisitNumbers } from '../src/services/journalTimeline';
import { hasStoredOriginal } from '../src/services/originals';
import { CONSENT_VERSION, useJournalStore } from '../src/store/journal';
import { colors, radius, spacing, typography } from '../src/theme';

const previewSpec = { engineVersion: '1.0', seed: 42, form: 'ribbon', palette: 'clay', fluidity: 0.57, complexity: 0.6 } as const;
const sampleDataEnabled = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_SAMPLE_DATA === '1';
const cardColors = ['#5C7CFF', '#B88CFF', '#FF9B70'];

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const { analysisError, uploadQueued, uploadError } = useLocalSearchParams<{ analysisError?: string; uploadQueued?: string; uploadError?: string }>();
  const hasHydrated = useJournalStore((state) => state.hasHydrated);
  const hasOnboarded = useJournalStore((state) => state.hasOnboarded);
  const consent = useJournalStore((state) => state.consent);
  const completeOnboarding = useJournalStore((state) => state.completeOnboarding);
  const entries = useJournalStore((state) => state.entries);
  const dataScope = useJournalStore((state) => state.dataScope);
  const remoteSyncStatus = useJournalStore((state) => state.remoteSyncStatus);
  const remoteSyncError = useJournalStore((state) => state.remoteSyncError);
  const remotePendingAnalysisCount = useJournalStore((state) => state.remotePendingAnalysisCount);
  const remoteAnalysisQueue = useJournalStore((state) => state.remoteAnalysisQueue);
  const addSampleEntries = useJournalStore((state) => state.addSampleEntries);
  const hasSamples = entries.some((entry) => entry.source === 'sample');
  const doctorReadyCount = useMemo(() => entries.filter(hasStoredOriginal).length, [entries]);
  const visitNumbers = useMemo(() => getVisitNumbers(entries), [entries]);
  const { status: authStatus } = useAuth();
  if (!hasHydrated) return <SafeAreaView style={uiStyles.screen} />;
  if (consent?.version !== CONSENT_VERSION) return <Redirect href="/consent" />;
  if (!hasOnboarded) return <Onboarding onContinue={completeOnboarding} />;

  const latest = entries[0];
  const pieceNumber = String(latest?.collectible?.serial ?? entries.length).padStart(3, '0');
  const crewEntries = entries.slice(0, 6);
  const wideCrew = windowWidth >= 720;
  const crewGap = 12;
  const crewColumns = wideCrew ? 3 : 2;
  const contentWidth = Math.max(272, Math.min(windowWidth, 900) - spacing.lg * 2);
  const crewCardWidth = Math.floor((contentWidth - crewGap * (crewColumns - 1)) / crewColumns);
  const crewCardHeight = Math.round(crewCardWidth * 1.18);
  const crewArtworkSize = Math.max(100, crewCardWidth - (wideCrew ? 42 : 24));
  const isCollectionLoading = dataScope === 'authenticated' && remoteSyncStatus === 'loading';
  const pendingAnalysis = remoteAnalysisQueue.find((item) => item.status === 'queued' || item.status === 'running');
  const manualAnalysis = remoteAnalysisQueue.find((item) => item.status === 'manual_required');

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.home]} showsVerticalScrollIndicator={false}>
      <View style={styles.topline}>
        <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandFace}>•ᴗ•</Text></View><Text style={styles.brandName}>GUTVERSE™</Text></View>
        <View style={styles.topActions}><Text accessibilityRole="button" onPress={() => router.push(authStatus === 'signed_in' ? '/account' : '/auth')} style={styles.privacyLink}>{authStatus === 'signed_in' ? 'ACCOUNT' : 'LOGIN'}</Text><Text accessibilityRole="button" onPress={() => router.push('/privacy')} style={styles.privacyLink}>PRIVACY</Text><Pill>{entries.length} PIECES</Pill></View>
      </View>

      <View style={styles.ticker}><Text numberOfLines={1} style={styles.tickerText}>ONE BODY · MANY WORLDS · PRIVATE BY DESIGN · COLLECT → REVEAL → REFLECT ·</Text></View>

      <View style={styles.introBlock}>
        <Eyebrow>YOUR PRIVATE BODY COLLECTION · DROP 001</Eyebrow>
        <Text style={styles.megaTitle}>YOUR GUT{`\n`}<Text style={styles.megaBlue}>UNIVERSE</Text>{`\n`}IS ALIVE.</Text>
        <View style={styles.introRow}><Text style={styles.intro}>每一次紀錄，都會長成一隻只屬於你的生物。收集它們，也慢慢看懂自己的身體節奏。</Text><View style={styles.oneOfOne}><Text style={styles.oneOfOneTop}>1/1</Text><Text style={styles.oneOfOneBottom}>UNIQUE</Text></View></View>
      </View>

      {analysisError === '1' ? <View style={styles.errorCard}><Text style={styles.errorTitle}>這次沒有完成分析</Text><Text style={uiStyles.muted}>這次沒有建立作品或保存紀錄。請重新拍攝一次。</Text></View> : null}
      {manualAnalysis ? <AnalysisRecoveryCard entryId={manualAnalysis.entryId} /> : null}
      {(uploadQueued === '1' || (dataScope === 'authenticated' && remotePendingAnalysisCount > 0)) ? <AnalysisLoadingCard
        pendingCount={remotePendingAnalysisCount || undefined}
        entryId={pendingAnalysis?.entryId}
      /> : null}
      {uploadError === '1' ? <View style={styles.errorCard}><Text style={styles.errorTitle}>私人上載未完成</Text><Text style={uiStyles.muted}>沒有把這次紀錄當成已完成作品。請確認網路與 Consent 後重新拍攝。</Text></View> : null}
      {uploadError === 'limit' ? <View style={styles.errorCard}><Text style={styles.errorTitle}>今天的分析額度已用完</Text><Text style={uiStyles.muted}>為了保護私人儲存與避免意外費用，Closed Beta 每天最多建立 10 筆新紀錄。已保存的 Gallery 不受影響，請明天再試。</Text></View> : null}
      {dataScope === 'authenticated' && remoteSyncStatus === 'error' ? <View style={styles.errorCard}><Text style={styles.errorTitle}>私人 Journal 暫時無法同步</Text><Text style={uiStyles.muted}>{remoteSyncError ?? '請確認網路後重新打開 App。Public Demo 資料不會代替你的私人資料。'}</Text></View> : null}

      <Pressable
        accessibilityRole={latest && !isCollectionLoading ? 'button' : undefined}
        accessibilityLabel={latest && !isCollectionLoading ? `打開最新作品 Gut Piece ${pieceNumber} 的詳細頁` : undefined}
        disabled={!latest || isCollectionLoading}
        onPress={() => latest && !isCollectionLoading && router.push({ pathname: '/result/[id]', params: { id: latest.id } })}
        style={({ pressed }) => [styles.heroCard, pressed && latest && !isCollectionLoading ? styles.piecePressed : null]}
      >
        <LinearGradient colors={['#5C7CFF', '#7548EE', '#17171F']} locations={[0, .56, 1]} style={StyleSheet.absoluteFill} />
        <Text style={styles.heroGhost}>GUT{`\n`}CREW</Text>
        <View style={styles.heroTop}><Text style={styles.heroCode}>VGJ / {isCollectionLoading ? 'SYNC' : latest ? pieceNumber : '000'}</Text><View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>{isCollectionLoading ? 'SYNCING' : latest ? 'COLLECTED' : 'READY TO MINT'}</Text></View></View>
        <Text style={styles.sparkOne}>✦</Text><Text style={styles.sparkTwo}>✦</Text>
        <View style={styles.artWrap}>{isCollectionLoading
          ? <LoadingStatusCard embedded eyebrow="PRIVATE COLLECTION" badgeLabel="SYNCING" title="正在載入你的私人收藏…" body="正在安全讀取你的 Journal、Gallery 與作品狀態。" />
          : <Artwork spec={latest?.artwork ?? previewSpec} serial={latest?.collectible?.serial} size={282} />}
        </View>
        <View style={styles.heroMeta}>
          <View><Text style={styles.heroLabel}>{isCollectionLoading ? 'PRIVATE COLLECTION · CONNECTING' : latest ? `${new Date(latest.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()} · VISIT ${String(visitNumbers.get(latest.id) ?? 1).padStart(2, '0')}` : 'YOUR FIRST CREATURE'}</Text><Text style={styles.heroTitle}>{isCollectionLoading ? '作品正在回到你的 Gallery' : latest ? `Gut Piece #${pieceNumber}` : '等待被揭曉'}</Text></View>
          {latest && !isCollectionLoading && <View style={styles.heroAction}><Pill tone="amber">TYPE {latest.analysis.bristolType}</Pill><Text style={styles.tapHint}>TAP TO VIEW ↗</Text></View>}
        </View>
      </Pressable>

      <PrimaryButton label="CREATE TODAY’S CREATURE  ↗" onPress={() => router.push('/capture')} />
      <MonthlyProgressCard entries={entries} onPress={() => router.push('/milestones')} />

      <View style={styles.privacy}>
        <View style={styles.privacyIcon}><Text style={styles.privacyFace}>◉</Text></View>
        <View style={styles.privacyCopy}><Text style={styles.privacyTitle}>ART OUTSIDE. ORIGINAL INSIDE.</Text><Text style={uiStyles.muted}>平時只看見作品；原圖留在 App 私人區，只有你主動按下才顯示。</Text></View>
        <Text style={styles.lock}>LOCKED</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="打開 Doctor Review，一次查看全部可用原圖與日期" onPress={() => router.push('/doctor-review')} style={({ pressed }) => [styles.doctorCard, pressed && styles.doctorPressed]}>
        <View style={styles.doctorTop}><Text style={styles.doctorEyebrow}>FOR A DOCTOR · PRIVATE VIEW</Text><Text style={styles.doctorCount}>{String(doctorReadyCount).padStart(2, '0')}</Text></View>
        <Text style={styles.doctorTitle}>DOCTOR{`\n`}REVIEW</Text>
        <Text style={styles.doctorBody}>一次確認，按日期顯示所有可用原圖。不用逐張解鎖，離開後自動重新鎖定。</Text>
        <Text style={styles.doctorLink}>{doctorReadyCount > 0 ? `VIEW ${doctorReadyCount} ORIGINAL${doctorReadyCount === 1 ? '' : 'S'}  ↗` : 'SEE HOW IT WORKS  ↗'}</Text>
      </Pressable>

      {sampleDataEnabled && dataScope !== 'authenticated' && !hasSamples ? <View style={styles.sampleCard}>
        <View style={styles.sampleTop}><Text style={styles.sampleEyebrow}>STARTER CREW</Text><Text style={styles.sampleCount}>05</Text></View>
        <Text style={styles.sampleTitle}>先遇見五天後的你</Text>
        <Text style={styles.sampleBody}>載入 5 隻示範生物，立即預覽收藏、健康情境、AI 信心度與解鎖進度。既有紀錄不會被覆蓋。</Text>
        <PrimaryButton label="MEET THE SAMPLE CREW" inverse onPress={addSampleEntries} />
      </View> : null}

      <View style={styles.sectionHead}><View><Eyebrow>THE PRIVATE DROP</Eyebrow><Text style={styles.collectionTitle}>YOUR CREW</Text></View><Text onPress={() => router.push('/gallery')} style={styles.link}>EXPLORE ALL ↗</Text></View>
      {entries.length === 0 ? <View style={styles.empty}><Text style={styles.emptyNumber}>01</Text><Text style={styles.emptyText}>第一隻生物還在等待你的紀錄。完成拍攝後，收藏世界就會開始成形。</Text></View> : <View style={[styles.miniGrid, { gap: crewGap }]}>{crewEntries.map((entry, index) => <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打開 Gut Piece ${entries.length - index} 的詳細頁`}
        key={entry.id}
        onPress={() => router.push({ pathname: '/result/[id]', params: { id: entry.id } })}
        style={({ pressed }) => [styles.miniArt, { backgroundColor: cardColors[index % cardColors.length], width: crewCardWidth, height: crewCardHeight }, pressed ? styles.piecePressed : null]}
      ><Text style={styles.miniSerial}>#{String(entry.collectible?.serial ?? entries.length - index).padStart(3, '0')}</Text><Artwork spec={entry.artwork} serial={entry.collectible?.serial} size={crewArtworkSize} /><View style={styles.miniVisit}><Text style={styles.miniVisitText}>V{String(visitNumbers.get(entry.id) ?? 1).padStart(2, '0')}</Text></View><View style={styles.miniOpen}><Text style={styles.miniOpenText}>OPEN ↗</Text></View></Pressable>)}</View>}
      <Text style={styles.footerWord}>GUTVERSE</Text>
    </ScrollView>
  </SafeAreaView>;
}

function AnalysisLoadingCard({ pendingCount, entryId }: { pendingCount?: number; entryId?: string }) {
  const card = <LoadingStatusCard
    eyebrow="PRIVATE CAPTURE · QUEUED"
    badgeLabel="QUEUED"
    title={pendingCount ? `${pendingCount} 筆紀錄等待 AI 分析` : '原圖已安全保存'}
    body={entryId ? '分析會在背景繼續。你也可以按此查看最新狀態。' : '已加入私人分析隊列；完成後會自動生成作品並出現在 Gallery。'}
    stages={['原圖已保存', '等待 AI 分析', '生成作品']}
  />;
  if (!entryId) return card;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel="查看這筆 AI 分析的最新狀態"
    onPress={() => router.push({ pathname: '/processing', params: { entryId } })}
    style={({ pressed }) => pressed ? styles.statusPressed : undefined}
  >{card}</Pressable>;
}

function AnalysisRecoveryCard({ entryId }: { entryId: string }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel="AI 無法完成，改為手動選擇 Bristol Type"
    onPress={() => router.push({ pathname: '/manual-analysis/[id]', params: { id: entryId } })}
    style={({ pressed }) => [styles.recoveryCard, pressed && styles.statusPressed]}
  >
    <Eyebrow>ANALYSIS NEEDS YOU</Eyebrow>
    <Text style={styles.recoveryTitle}>AI 未能可靠完成這次估算</Text>
    <Text style={styles.recoveryBody}>照片與紀錄仍然安全保存。按此手動選擇最接近的形態，約需 10 秒。</Text>
    <Text style={styles.recoveryLink}>CHOOSE MANUALLY  ↗</Text>
  </Pressable>;
}

function LoadingStatusCard({ eyebrow, badgeLabel, title, body, stages, embedded = false }: { eyebrow: string; badgeLabel: string; title: string; body: string; stages?: [string, string, string]; embedded?: boolean }) {
  const { width: windowWidth } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1700,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const travelDistance = Math.max(320, Math.min(windowWidth, 900));
  const scanX = progress.interpolate({ inputRange: [0, 1], outputRange: [-150, travelDistance] });
  const pulseOpacity = progress.interpolate({ inputRange: [0, .5, 1], outputRange: [.45, 1, .45] });
  const pulseScale = progress.interpolate({ inputRange: [0, .5, 1], outputRange: [.8, 1.15, .8] });

  return <View
    accessibilityRole="progressbar"
    accessibilityValue={{ text: stages ? '等待 AI 分析' : '正在載入私人收藏' }}
    style={[styles.syncCard, embedded && styles.syncCardEmbedded]}
  >
    <View style={styles.loadingTop}>
      <Text style={styles.syncEyebrow}>{eyebrow}</Text>
      <View style={styles.loadingBadge}>
        <Animated.View style={[styles.loadingDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
        <Text style={styles.loadingBadgeText}>{badgeLabel}</Text>
      </View>
    </View>
    <Text style={[styles.syncTitle, embedded && styles.loadingEmbeddedCopy]}>{title}</Text>
    <Text style={[styles.loadingBody, embedded && styles.loadingEmbeddedCopy]}>{body}</Text>
    <View style={styles.loadingTrack}>
      <Animated.View style={[styles.loadingScan, { transform: [{ translateX: scanX }] }]} />
    </View>
    {stages ? <View style={styles.loadingStages}>
      <View style={styles.loadingStage}><View style={[styles.stageMarker, styles.stageComplete]}><Text style={styles.stageCheck}>✓</Text></View><Text style={styles.stageCompleteText}>{stages[0]}</Text></View>
      <View style={styles.loadingStage}><Animated.View style={[styles.stageMarker, styles.stageActive, { opacity: pulseOpacity }]} /><Text style={styles.stageActiveText}>{stages[1]}</Text></View>
      <View style={styles.loadingStage}><View style={styles.stageMarker} /><Text style={styles.stageNextText}>{stages[2]}</Text></View>
    </View> : null}
  </View>;
}

function Onboarding({ onContinue }: { onContinue: () => void }) {
  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.onboarding]} showsVerticalScrollIndicator={false}>
      <View style={styles.topline}><View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandFace}>•ᴗ•</Text></View><Text style={styles.brandName}>GUTVERSE™</Text></View><Text accessibilityRole="button" onPress={() => router.push('/auth')} style={styles.privacyLink}>LOGIN ↗</Text></View>
      <Eyebrow>PRIVATE BY DESIGN · YOUR FIRST DROP</Eyebrow>
      <Text style={[uiStyles.title, styles.onboardingTitle]}>THE PHOTO{`\n`}TRANSFORMS.{`\n`}<Text style={styles.megaBlue}>THE STORY STAYS.</Text></Text>
      <View style={styles.orbit}><Text style={styles.orbitWord}>HELLO</Text><Artwork spec={previewSpec} size={292} /></View>
      <Text style={uiStyles.body}>把每天最不想留下的照片，變成值得收藏的身體生物與長期故事。</Text>
      <View style={styles.steps}>
        {['App 內拍攝，不進相簿', 'Roboflow 估算 Bristol Type 1–7', '原圖安全隱藏在作品背後'].map((item, index) => <View key={item} style={styles.step}><Text style={styles.stepNo}>0{index + 1}</Text><Text style={styles.stepText}>{item}</Text></View>)}
      </View>
      <PrimaryButton label="CREATE MY FIRST CREATURE" onPress={onContinue} />
      <Text style={[uiStyles.muted, styles.disclaimer]}>Wellness journal only · 不提供醫療診斷。Consent 與 Privacy 選擇可隨時查看。</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  home: { paddingTop: spacing.md, gap: spacing.lg },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  brandFace: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, fontWeight: '900' },
  brandName: { color: colors.cream, fontFamily: typography.body, fontSize: 13, fontWeight: '900', letterSpacing: -.2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  privacyLink: { color: colors.muted, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, paddingVertical: 8 },
  ticker: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#30303A', paddingVertical: 10, overflow: 'hidden' },
  tickerText: { color: colors.amber, fontFamily: typography.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  introBlock: { gap: spacing.md, paddingTop: spacing.sm },
  megaTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 64, lineHeight: 55, letterSpacing: -3, fontWeight: '900' },
  megaBlue: { color: colors.peach },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  intro: { flex: 1, maxWidth: 520, color: colors.sage, fontFamily: typography.body, fontSize: 14, lineHeight: 21 },
  oneOfOne: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '9deg' }] },
  oneOfOneTop: { color: colors.ink, fontFamily: typography.display, fontSize: 24, lineHeight: 24, fontWeight: '900' },
  oneOfOneBottom: { color: colors.ink, fontFamily: typography.body, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  errorCard: { backgroundColor: '#3A2025', borderRadius: radius.md, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.danger },
  errorTitle: { color: colors.cream, fontFamily: typography.body, fontWeight: '800' },
  recoveryCard: { backgroundColor: '#33274D', borderRadius: radius.md, padding: spacing.md, gap: 8, borderWidth: 1, borderColor: colors.peach },
  recoveryTitle: { color: colors.cream, fontFamily: typography.body, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  recoveryBody: { color: colors.sage, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  recoveryLink: { color: colors.amber, fontFamily: typography.mono, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  statusPressed: { opacity: .82, transform: [{ scale: .995 }] },
  syncCard: { backgroundColor: '#203D33', borderRadius: radius.md, padding: spacing.md, gap: 8, borderWidth: 1, borderColor: '#3E5E51', overflow: 'hidden' },
  syncCardEmbedded: { width: '86%', maxWidth: 560, backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: spacing.sm },
  syncEyebrow: { color: colors.amber, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  syncTitle: { color: colors.cream, fontFamily: typography.body, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  loadingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  loadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#111B18', borderWidth: 1, borderColor: '#3E5E51' },
  loadingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
  loadingBadgeText: { color: colors.cream, fontFamily: typography.mono, fontSize: 7, fontWeight: '900', letterSpacing: .8 },
  loadingBody: { color: colors.sage, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  loadingEmbeddedCopy: { textAlign: 'center' },
  loadingTrack: { height: 4, marginTop: 3, borderRadius: radius.pill, backgroundColor: '#13221D', overflow: 'hidden' },
  loadingScan: { width: 130, height: 4, borderRadius: radius.pill, backgroundColor: colors.amber, shadowColor: colors.amber, shadowOpacity: .7, shadowRadius: 7 },
  loadingStages: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  loadingStage: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 112 },
  stageMarker: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: '#64716C', alignItems: 'center', justifyContent: 'center' },
  stageComplete: { backgroundColor: colors.amber, borderColor: colors.amber },
  stageActive: { backgroundColor: colors.peach, borderColor: colors.cream },
  stageCheck: { color: colors.ink, fontSize: 9, lineHeight: 11, fontWeight: '900' },
  stageCompleteText: { color: colors.cream, fontFamily: typography.body, fontSize: 10, fontWeight: '800' },
  stageActiveText: { color: colors.peach, fontFamily: typography.body, fontSize: 10, fontWeight: '900' },
  stageNextText: { color: colors.muted, fontFamily: typography.body, fontSize: 10, fontWeight: '700' },
  heroCard: { height: 440, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 2, borderColor: colors.cream },
  heroGhost: { position: 'absolute', left: -5, top: 72, color: 'rgba(246,243,236,.09)', fontFamily: typography.display, fontSize: 128, lineHeight: 100, letterSpacing: -8, fontWeight: '900' },
  heroTop: { padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 },
  heroCode: { color: colors.cream, fontFamily: typography.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
  liveText: { color: colors.cream, fontFamily: typography.body, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sparkOne: { position: 'absolute', zIndex: 2, top: 88, right: 24, color: colors.amber, fontSize: 32 },
  sparkTwo: { position: 'absolute', zIndex: 2, bottom: 110, left: 26, color: colors.coral, fontSize: 24 },
  artWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -20 },
  heroMeta: { padding: spacing.md, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', backgroundColor: colors.ink, borderTopWidth: 2, borderColor: colors.cream },
  heroLabel: { color: colors.amber, fontFamily: typography.body, fontWeight: '900', letterSpacing: 1.5, fontSize: 9 },
  heroTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 22, fontWeight: '900', marginTop: 2 },
  heroAction: { alignItems: 'flex-end', gap: 5 },
  tapHint: { color: colors.muted, fontFamily: typography.mono, fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  piecePressed: { opacity: .84, transform: [{ translateY: 4 }, { scale: .99 }] },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#343440' },
  privacyIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.peach, alignItems: 'center', justifyContent: 'center' },
  privacyFace: { color: colors.peach, fontSize: 16 },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: colors.cream, fontFamily: typography.body, fontSize: 12, fontWeight: '900', marginBottom: 3, letterSpacing: .5 },
  lock: { color: colors.muted, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1, transform: [{ rotate: '90deg' }] },
  doctorCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.peach, borderWidth: 2, borderColor: colors.cream, overflow: 'hidden' },
  doctorPressed: { opacity: .86, transform: [{ translateY: 3 }] },
  doctorTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  doctorEyebrow: { color: colors.ink, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  doctorCount: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 38, fontWeight: '900' },
  doctorTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 52, lineHeight: 44, letterSpacing: -1.8, fontWeight: '900' },
  doctorBody: { maxWidth: 560, color: colors.ink, fontFamily: typography.body, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  doctorLink: { color: colors.ink, fontFamily: typography.body, fontSize: 11, fontWeight: '900', letterSpacing: .8, textDecorationLine: 'underline' },
  sampleCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.cream },
  sampleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sampleEyebrow: { color: colors.ink, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  sampleCount: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 42, fontWeight: '900' },
  sampleTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 31, fontWeight: '900' },
  sampleBody: { color: '#33221B', fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  sectionHead: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  collectionTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 46, lineHeight: 46, fontWeight: '900', letterSpacing: -1.5 },
  link: { color: colors.amber, fontFamily: typography.body, fontWeight: '900', fontSize: 10, letterSpacing: .8, paddingVertical: 8 },
  empty: { borderTopWidth: 1, borderColor: '#343440', paddingTop: spacing.md, flexDirection: 'row', gap: spacing.md },
  emptyNumber: { color: colors.peach, fontFamily: typography.display, fontSize: 38, fontWeight: '900' },
  emptyText: { flex: 1, color: colors.sage, fontFamily: typography.body, lineHeight: 21 },
  miniGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  miniArt: { flexGrow: 0, flexShrink: 0, overflow: 'hidden', borderRadius: radius.md, borderWidth: 2, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  miniSerial: { position: 'absolute', top: 9, left: 10, zIndex: 2, color: colors.ink, fontFamily: typography.mono, fontSize: 8, fontWeight: '900' },
  miniVisit: { position: 'absolute', left: 7, bottom: 7, zIndex: 2, borderRadius: radius.pill, backgroundColor: 'rgba(246,243,236,.92)', paddingHorizontal: 7, paddingVertical: 5 },
  miniVisitText: { color: colors.ink, fontFamily: typography.mono, fontSize: 6.5, fontWeight: '900', letterSpacing: .2 },
  miniOpen: { position: 'absolute', right: 7, bottom: 7, zIndex: 2, borderRadius: radius.pill, backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 5 },
  miniOpenText: { color: colors.cream, fontFamily: typography.mono, fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  footerWord: { color: '#1C1C24', fontFamily: typography.display, fontSize: 72, lineHeight: 72, fontWeight: '900', letterSpacing: -4, textAlign: 'center', marginTop: spacing.md },
  onboarding: { paddingTop: spacing.lg, flexGrow: 1, gap: spacing.lg },
  onboardingTitle: { marginTop: 2 },
  orbit: { flex: 1, minHeight: 300, borderRadius: radius.lg, backgroundColor: colors.peach, borderWidth: 2, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orbitWord: { position: 'absolute', color: 'rgba(246,243,236,.2)', fontFamily: typography.display, fontSize: 92, fontWeight: '900' },
  steps: { borderTopWidth: 1, borderColor: '#343440' },
  step: { flexDirection: 'row', gap: 16, paddingVertical: 11, borderBottomWidth: 1, borderColor: '#343440' },
  stepNo: { color: colors.amber, fontFamily: typography.mono, width: 26, fontWeight: '900' },
  stepText: { color: colors.cream, fontFamily: typography.body, fontSize: 14, fontWeight: '700' },
  disclaimer: { textAlign: 'center', paddingHorizontal: 10 },
});
