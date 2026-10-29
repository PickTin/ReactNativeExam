import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useAppTheme } from '../ThemeContext';
const Day = ({ day, month, isToday, onPress, hasTasks }) => {
    const { colors } = useAppTheme();
    const styles = makeStyles(colors);

    return (
        <Pressable style={styles.day} onPress={onPress}>
            <View style={styles.dayContent}>
                <Text style={[
                    styles.dayText,
                    month !== 'current' && styles.otherDay,
                    isToday && styles.today,
                ]}>
                    {day}
                </Text>
                {hasTasks && <View style={styles.dot} />}
            </View>
        </Pressable>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    day: {
        width: '14.285%',
        height: 58,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    dayContent: { alignItems: 'center', justifyContent: 'center', minWidth: 30, minHeight: 38 },
    dayText: { color: colors.text, fontSize: 15, textAlign: 'center' },
    otherDay: { color: colors.mutedDay },
    today: {
        color: colors.todayText,
        backgroundColor: colors.today,
        overflow: 'hidden',
        borderRadius: 18,
        minWidth: 32,
        textAlign: 'center',
        paddingHorizontal: 8,
        paddingVertical: 5,
        fontWeight: '700',
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: colors.dot,
        alignSelf: 'center',
        marginTop: 3,
    },
});

export default Day;
