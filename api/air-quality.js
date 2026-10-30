
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "허용되지 않은 요청입니다."
    });
  }

  const API_KEY = process.env.AIRKOREA_SERVICE_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      error: "Vercel 환경변수에 API 키가 없습니다."
    });
  }

  // 기존에 정상 작동했던 에어코리아 API 주소
  const API_URL =
    "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";

  const params = new URLSearchParams({
    serviceKey: API_KEY,
    returnType: "json",
    numOfRows: "100",
    pageNo: "1",
    sidoName: "서울",
    ver: "1.0"
  });

  try {
    const response = await fetch(
      `${API_URL}?${params.toString()}`
    );

    const data = await response.json();

    console.log("에어코리아 응답:", data);

    if (!response.ok) {
      return res.status(502).json({
        error: "에어코리아 API 요청 실패",
        details: data
      });
    }

    if (!data?.response?.body?.items) {
      return res.status(502).json({
        error: "에어코리아 응답에 대기질 데이터가 없습니다.",
        details: data
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("대기질 API 오류:", error);

    return res.status(500).json({
      error: "대기질 정보를 가져오지 못했습니다."
    });
  }
}
