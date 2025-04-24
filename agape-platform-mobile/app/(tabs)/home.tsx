import React from 'react';
import { ScrollView, Text, View, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Card, { CardHeader, CardTitle, CardContent, CardDescription } from '@/components/Card'; // Use Card components
import Button from '@/components/Button';
import { getMeetings } from '@/services/meetingService'; // Assuming service exists
import { getPrayerRequests } from '@/services/prayerService'; // Assuming service exists
import { useAuth } from '@/contexts/AuthContext';
import { Meeting, PrayerRequest } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';

const fetchDashboardData = async () => {
  // Fetch limited data for the dashboard view
  const [meetingsData, prayerData] = await Promise.all([
    getMeetings({ upcoming: 'true', limit: 3, status: 'scheduled' }), // Fetch 3 upcoming scheduled
    getPrayerRequests({ status: 'active', limit: 3 }), // Fetch 3 active requests
    // Add fetch for announcements if needed
  ]);
  return {
    upcomingMeetings: meetingsData.meetings,
    activePrayerRequests: prayerData.prayer_requests,
  };
};

const DashboardSection = ({ title, children, iconName }: { title: string, children: React.ReactNode, iconName?: React.ComponentProps<typeof Ionicons>['name'] }) => (
  <Card className="mb-6">
    <CardHeader className="flex-row items-center justify-between pb-2 mb-2 border-b border-border">
      <View className="flex-row items-center">
        {iconName && <Ionicons name={iconName} size={20} color={Colors.light.primary} className="mr-2 text-primary" />}
        <CardTitle>{title}</CardTitle>
      </View>
      {/* Optional: Add 'View All' button */}
    </CardHeader>
    <CardContent>
      {children}
    </CardContent>
  </Card>
);

const MeetingItem = ({ meeting, onPress }: { meeting: Meeting, onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} className="flex-row items-center py-2">
    <View className="mr-3">
      <Ionicons name="calendar-outline" size={22} className="text-secondary" />
    </View>
    <View className="flex-1">
      <Text className="text-base font-medium text-foreground" numberOfLines={1}>{meeting.title}</Text>
      <Text className="text-sm text-muted-foreground">
        {new Date(meeting.scheduled_start).toLocaleDateString()} - {new Date(meeting.scheduled_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </Text>
    </View>
    <Ionicons name="chevron-forward-outline" size={18} className="text-muted-foreground" />
  </TouchableOpacity>
);

const PrayerItem = ({ request, onPress }: { request: PrayerRequest, onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} className="py-2">
    <View className="flex-row items-start mb-1">
      <Ionicons name="heart-outline" size={18} className="text-accent mr-2 mt-0.5" />
      <Text className="text-sm text-foreground flex-1" numberOfLines={2}>
        {request.is_anonymous ? 'Anonymous Request' : `${request.user?.first_name || 'User'}: `}{request.content}
      </Text>
    </View>
    <Text className="text-xs text-muted-foreground ml-6">{request.praying_users?.length || 0} Praying</Text>
  </TouchableOpacity>
);


export default function HomeScreen() {
  const { authState } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const colors = Colors[colorScheme ?? 'light'];

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const renderContent = () => {
    if (isLoading && !data) {
      return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color={colors.primary} /></View>;
    }
    if (error) {
      return (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-destructive text-center mb-4">Error loading dashboard data: {error.message}</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" />
        </View>
      );
    }
    if (!data) {
      return <View className="flex-1 justify-center items-center"><Text className="text-muted-foreground">No data available.</Text></View>;
    }

    const { upcomingMeetings, activePrayerRequests } = data;

    return (
      <>
        {/* Upcoming Meetings Section */}
        <DashboardSection title="Upcoming Meetings" iconName="calendar-outline">
          {upcomingMeetings.length > 0 ? (
            upcomingMeetings.map((meeting) => (
              <MeetingItem key={meeting._id} meeting={meeting} onPress={() => router.push(`/meeting/${meeting._id}`)} />
            ))
          ) : (
            <Text className="text-muted-foreground text-center py-4">No upcoming meetings scheduled.</Text>
          )}
          <Button
            title="View All Meetings"
            variant="link"
            onPress={() => router.push('/(tabs)/meetings')}
            className="mt-2 self-start"
            textClassName='text-sm'
          />
        </DashboardSection>

        {/* Prayer Requests Section */}
        <DashboardSection title="Prayer Wall Highlights" iconName="heart-outline">
          {activePrayerRequests.length > 0 ? (
            activePrayerRequests.map((request) => (
              <PrayerItem key={request._id} request={request} onPress={() => router.push('/(tabs)/prayer')} /> // Navigate to prayer tab for details for now
            ))
          ) : (
            <Text className="text-muted-foreground text-center py-4">No active prayer requests.</Text>
          )}
          <Button
            title="Go to Prayer Wall"
            variant="link"
            onPress={() => router.push('/(tabs)/prayer')}
            className="mt-2 self-start"
            textClassName='text-sm'
          />
        </DashboardSection>

        {/* Add Announcements Section similarly if data is fetched */}
        <DashboardSection title="Announcements" iconName="megaphone-outline">
          <Text className="text-muted-foreground text-center py-4">No recent announcements.</Text>
          {/* Add View All link if needed */}
        </DashboardSection>
      </>
    );
  };

  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <ScrollView
        className="p-4"
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        contentContainerClassName="pb-8" // Add padding at the bottom
      >
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-1">Welcome, {authState.currentUser?.first_name}</Text>
          <Text className="text-base text-muted-foreground">Here's what's happening today.</Text>
        </View>
        {renderContent()}
      </ScrollView>
    </SafeAreaWrapper>
  );
}
