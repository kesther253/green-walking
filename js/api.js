
async function getAirQuality() {
  try {
    const response = await fetch(
  "https://green-walking-ten.vercel.app/api/air-quality"
);

    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status}`);
    }

    const data = await response.json();

    console.log("대기질 API 응답:", data);

    // API 응답 데이터 확인
    if (!data?.response?.body?.items) {
      throw new Error("대기질 데이터 형식이 올바르지 않습니다.");
    }

    return data.response.body.items;

  } catch (error) {
    console.error("대기질 데이터 조회 실패:", error);
    return [];
  }
}
